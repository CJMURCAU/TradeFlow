import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// --- CORS (audit S-H2): allow-list origins instead of "*" -------------------
// Configure with ALLOWED_ORIGINS (comma-separated). Native apps send no Origin
// header, so those requests are always allowed; browser requests are checked.
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ??
  "https://tradeflowmanager.com,http://localhost:8081,http://localhost:19006")
  .split(",")
  .map((o: string) => o.trim())
  .filter(Boolean);

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  const allowOrigin = !origin
    ? ALLOWED_ORIGINS[0]
    : ALLOWED_ORIGINS.includes(origin)
    ? origin
    : "null";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
  };
}

// --- HTML escaping (audit S-M2): never interpolate stored values raw ---------
function esc(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function json(body: unknown, status: number, req: Request): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders(req) });
  }

  try {
    // --- AuthN (audit S-C1): require a verified caller -----------------------
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Unauthorized" }, 401, req);
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) {
      return json({ error: "Unauthorized" }, 401, req);
    }

    const { jobId } = await req.json();
    if (!jobId) {
      return json({ error: "jobId is required" }, 400, req);
    }

    // Service-role client for assembling related rows AFTER authorization.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("*, client:clients(*)")
      .eq("id", jobId)
      .maybeSingle();

    if (jobError || !job) {
      return json({ error: "Job not found" }, 404, req);
    }

    // --- AuthZ (audit S-C1): only the job's owner may send its card ----------
    if (job.user_id !== user.id) {
      return json({ error: "Forbidden" }, 403, req);
    }

    const client = Array.isArray(job.client) ? job.client[0] : job.client;

    const [partsRes, timeEntriesRes, businessRes, employeesRes, assignmentsRes] = await Promise.all([
      supabase.from("parts").select("*").eq("job_id", jobId),
      supabase.from("time_entries").select("*").eq("job_id", jobId),
      supabase.from("business_details").select("*").eq("user_id", job.user_id).maybeSingle(),
      supabase.from("employees").select("*").eq("user_id", job.user_id).eq("status", "active"),
      supabase.from("job_assignments").select("employee_id, completed").eq("job_id", jobId),
    ]);

    const parts: { name: string; cost: number; quantity: number; employee_id: string | null }[] = partsRes.data || [];
    const timeEntries: { start_time: string; end_time: string | null; employee_id: string | null }[] = timeEntriesRes.data || [];
    const business = businessRes.data;
    const employees: { id: string; name: string; hourly_rate: number | null }[] = employeesRes.data || [];
    const assignments: { employee_id: string; completed: boolean }[] = assignmentsRes.data || [];

    const defaultRate: number = business?.default_hourly_rate ?? 0;
    const tradesmanName: string = business?.tradesman_name || "Owner";
    const companyName: string = business?.company_name || "Your Service Provider";

    // Cost rules MUST match the on-screen summary (audit A-M3): owner time is
    // live up to now; employee time counts only for completed assignments and
    // ended entries; employee parts count only once their assignment completed.
    const completed = new Set(assignments.filter(a => a.completed).map(a => a.employee_id));
    const nowMs = Date.now();
    const secondsBetween = (start: string, end: string | null): number =>
      Math.floor(((end ? new Date(end).getTime() : nowMs) - new Date(start).getTime()) / 1000);

    // Owner labour: entries with no employee_id (running entry ticks to now)
    const ownerSeconds = timeEntries
      .filter(e => e.employee_id == null)
      .reduce((sum, entry) => sum + secondsBetween(entry.start_time, entry.end_time), 0);
    const ownerCost = (ownerSeconds / 3600) * defaultRate;

    // Employee labour: only completed assignments, only ended entries
    const empRateMap = new Map(employees.map(e => [e.id, { name: e.name, rate: e.hourly_rate ?? defaultRate }]));
    const empRowMap = new Map<string, { name: string; seconds: number; rate: number }>();
    timeEntries
      .filter(e => e.employee_id != null && completed.has(e.employee_id) && e.end_time != null)
      .forEach(entry => {
        const empId = entry.employee_id!;
        const empInfo = empRateMap.get(empId) ?? { name: "Employee", rate: defaultRate };
        const secs = secondsBetween(entry.start_time, entry.end_time);
        const existing = empRowMap.get(empId);
        if (existing) existing.seconds += secs;
        else empRowMap.set(empId, { name: empInfo.name, seconds: secs, rate: empInfo.rate });
      });
    const empRows = Array.from(empRowMap.values());
    const empLabourCost = empRows.reduce((sum, r) => sum + (r.seconds / 3600) * r.rate, 0);
    const totalLabourCost = ownerCost + empLabourCost;

    const totalSeconds = ownerSeconds + empRows.reduce((sum, r) => sum + r.seconds, 0);
    const timeFormatted = formatTime(totalSeconds);

    const includedParts = parts.filter(p => p.employee_id == null || completed.has(p.employee_id));
    const totalPartsCost = includedParts.reduce((sum, p) => sum + p.cost * p.quantity, 0);
    const totalCost = totalLabourCost + totalPartsCost;

    const labourRowsHtml = `
      <tr>
        <td style="padding:5px 0 2px;font-size:11px;color:#555555;text-transform:uppercase;letter-spacing:0.06em;" colspan="2">Labour Cost</td>
      </tr>
      <tr>
        <td style="padding:3px 0 3px 12px;font-size:14px;color:#000000;">
          ${esc(tradesmanName)}
          <span style="font-size:12px;color:#555555;"> — ${formatTime(ownerSeconds)}${defaultRate > 0 ? ` @ $${defaultRate.toFixed(2)}/hr` : ""}</span>
        </td>
        <td style="padding:3px 0;font-size:14px;font-weight:700;color:#000000;text-align:right;">${defaultRate > 0 ? `$${ownerCost.toFixed(2)}` : "&mdash;"}</td>
      </tr>
      ${empRows.map(r => `
      <tr>
        <td style="padding:3px 0 3px 12px;font-size:14px;color:#000000;">
          ${esc(r.name)}
          <span style="font-size:12px;color:#555555;"> — ${formatTime(r.seconds)} @ $${r.rate.toFixed(2)}/hr</span>
        </td>
        <td style="padding:3px 0;font-size:14px;font-weight:700;color:#000000;text-align:right;">$${((r.seconds / 3600) * r.rate).toFixed(2)}</td>
      </tr>`).join("")}
      <tr>
        <td style="padding:3px 0 6px 12px;font-size:14px;color:#000000;">Labour Total</td>
        <td style="padding:3px 0 6px;font-size:15px;font-weight:700;color:#000000;text-align:right;">$${totalLabourCost.toFixed(2)}</td>
      </tr>`;

    const partsHtml = includedParts.length > 0
      ? `
        <table style="width:100%;border-collapse:collapse;margin-top:8px;">
          <thead>
            <tr style="background:#f3f4f6;">
              <th style="text-align:left;padding:8px 12px;border:1px solid #e5e7eb;font-size:14px;">Part</th>
              <th style="text-align:right;padding:8px 12px;border:1px solid #e5e7eb;font-size:14px;">Unit Cost</th>
              <th style="text-align:right;padding:8px 12px;border:1px solid #e5e7eb;font-size:14px;">Qty</th>
              <th style="text-align:right;padding:8px 12px;border:1px solid #e5e7eb;font-size:14px;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${includedParts
              .map(
                (p) => `
              <tr>
                <td style="padding:8px 12px;border:1px solid #e5e7eb;font-size:14px;">${esc(p.name)}</td>
                <td style="text-align:right;padding:8px 12px;border:1px solid #e5e7eb;font-size:14px;">$${p.cost.toFixed(2)}</td>
                <td style="text-align:right;padding:8px 12px;border:1px solid #e5e7eb;font-size:14px;">${p.quantity}</td>
                <td style="text-align:right;padding:8px 12px;border:1px solid #e5e7eb;font-size:14px;">$${(p.cost * p.quantity).toFixed(2)}</td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>`
      : `<p style="color:#6b7280;font-size:14px;">No parts used.</p>`;

    const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#ffffff;">
    <div style="padding:40px 40px 24px;border-bottom:3px solid #000000;">
      <h1 style="margin:0 0 6px;color:#000000;font-size:28px;font-weight:700;letter-spacing:-0.5px;">${esc(companyName)}</h1>
      <p style="margin:0;color:#000000;font-size:15px;font-weight:400;letter-spacing:0.03em;">JOB CARD #${esc(job.job_card_number)}</p>
    </div>
    <div style="padding:32px 40px;">
      <h2 style="margin:0 0 4px;color:#000000;font-size:20px;font-weight:700;">${esc(job.title)}</h2>
      ${job.purchase_order_number ? `<p style="margin:0 0 16px;color:#555555;font-size:14px;">PO: ${esc(job.purchase_order_number)}</p>` : ""}

      <div style="padding:16px;margin:20px 0;border:1px solid #000000;">
        <p style="margin:0 0 4px;font-size:11px;color:#000000;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">Client</p>
        ${client?.company_name ? `<p style="margin:0;font-size:16px;color:#000000;font-weight:600;">${esc(client.company_name)}</p>` : ""}
        <p style="margin:${client?.company_name ? "4px" : "0"} 0 0;font-size:14px;color:#000000;">${esc(client?.name)}</p>
        ${client?.phone ? `<p style="margin:4px 0 0;font-size:14px;color:#000000;">${esc(client.phone)}</p>` : ""}
        ${client?.address ? `<p style="margin:4px 0 0;font-size:14px;color:#000000;">${esc(client.address)}</p>` : ""}
      </div>

      ${job.description ? `
      <div style="margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:11px;color:#000000;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">Description</p>
        <p style="margin:0;font-size:15px;color:#000000;line-height:1.6;">${esc(job.description)}</p>
      </div>` : ""}

      <div style="margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:11px;color:#000000;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">Parts Used</p>
        ${partsHtml}
      </div>

      <div style="padding:16px;border:1px solid #000000;">
        <p style="margin:0 0 12px;font-size:11px;color:#000000;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">Cost Summary</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:5px 0;font-size:15px;color:#000000;">Total Time</td>
            <td style="padding:5px 0;font-size:15px;font-weight:700;color:#000000;text-align:right;">${timeFormatted}</td>
          </tr>
          ${labourRowsHtml}
          <tr>
            <td style="padding:5px 0;font-size:15px;color:#000000;">Parts Cost</td>
            <td style="padding:5px 0;font-size:15px;font-weight:700;color:#000000;text-align:right;">$${totalPartsCost.toFixed(2)}</td>
          </tr>
          <tr>
            <td colspan="2" style="padding:4px 0;"><hr style="border:none;border-top:1px solid #000000;margin:4px 0;" /></td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:17px;font-weight:700;color:#000000;">Total</td>
            <td style="padding:5px 0;font-size:17px;font-weight:700;color:#000000;text-align:right;">$${totalCost.toFixed(2)}</td>
          </tr>
        </table>
      </div>

      ${tradesmanName ? `<p style="margin:24px 0 0;font-size:14px;color:#000000;">Completed by ${esc(tradesmanName)}</p>` : ""}
    </div>
    <div style="padding:16px 40px;border-top:1px solid #000000;">
      <p style="margin:0;font-size:12px;color:#555555;text-align:center;">${esc(companyName)} &mdash; Job Card #${esc(job.job_card_number)}</p>
    </div>
  </div>
</body>
</html>`;

    const mailtrapToken = Deno.env.get("MAILTRAP_API_TOKEN");
    if (!mailtrapToken) {
      console.error("send-job-card: MAILTRAP_API_TOKEN not configured");
      return json({ error: "Email is not configured. Please contact support." }, 500, req);
    }

    if (!business?.job_email) {
      return json(
        { error: "No job card email set in Business settings. Please add one before sending." },
        400,
        req
      );
    }

    const recipientEmail = business.job_email;

    const mailtrapResponse = await fetch("https://send.api.mailtrap.io/api/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${mailtrapToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: { name: companyName, email: "hello@tradeflowmanager.com" },
        to: [{ email: recipientEmail }],
        reply_to: { email: recipientEmail },
        subject: `Job Card #${job.job_card_number} - ${job.title}`,
        html: emailHtml,
      }),
    });

    // --- Don't leak provider internals to the client (audit S-M3) -----------
    if (!mailtrapResponse.ok) {
      const detail = await mailtrapResponse.text();
      console.error("send-job-card: email provider error", mailtrapResponse.status, detail);
      return json({ error: "Failed to send the job card email. Please try again." }, 502, req);
    }

    await supabase
      .from("jobs")
      .update({ email_sent: true, status: "completed" })
      .eq("id", jobId);

    return json({ success: true, sentTo: recipientEmail }, 200, req);
  } catch (err) {
    console.error("send-job-card: unexpected error", err);
    return json({ error: "Something went wrong. Please try again." }, 500, req);
  }
});
