import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { jobId } = await req.json();

    if (!jobId) {
      return new Response(JSON.stringify({ error: "jobId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const client = Array.isArray(job.client) ? job.client[0] : job.client;

    const { data: parts } = await supabase
      .from("parts")
      .select("*")
      .eq("job_id", jobId);

    const { data: timeEntries } = await supabase
      .from("time_entries")
      .select("*")
      .eq("job_id", jobId);

    const { data: business } = await supabase
      .from("business_details")
      .select("*")
      .maybeSingle();

    const totalPartsCost = (parts || []).reduce(
      (sum: number, p: { cost: number; quantity: number }) => sum + p.cost * p.quantity,
      0
    );

    const totalSeconds = (timeEntries || []).reduce(
      (sum: number, entry: { start_time: string; end_time: string | null }) => {
        const start = new Date(entry.start_time).getTime();
        const end = entry.end_time ? new Date(entry.end_time).getTime() : Date.now();
        return sum + Math.floor((end - start) / 1000);
      },
      0
    );

    const timeHours = Math.floor(totalSeconds / 3600);
    const timeMinutes = Math.floor((totalSeconds % 3600) / 60);
    const timeSecs = totalSeconds % 60;
    const timeFormatted = `${String(timeHours).padStart(2, "0")}:${String(timeMinutes).padStart(2, "0")}:${String(timeSecs).padStart(2, "0")}`;

    const hourlyRate = business?.default_hourly_rate ?? 0;
    const labourCost = (totalSeconds / 3600) * hourlyRate;
    const totalCost = labourCost + totalPartsCost;

    const partsHtml = (parts || []).length > 0
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
            ${(parts || [])
              .map(
                (p: { name: string; cost: number; quantity: number }) => `
              <tr>
                <td style="padding:8px 12px;border:1px solid #e5e7eb;font-size:14px;">${p.name}</td>
                <td style="text-align:right;padding:8px 12px;border:1px solid #e5e7eb;font-size:14px;">$${p.cost.toFixed(2)}</td>
                <td style="text-align:right;padding:8px 12px;border:1px solid #e5e7eb;font-size:14px;">${p.quantity}</td>
                <td style="text-align:right;padding:8px 12px;border:1px solid #e5e7eb;font-size:14px;">$${(p.cost * p.quantity).toFixed(2)}</td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>`
      : `<p style="color:#6b7280;font-size:14px;">No parts used.</p>`;

    const companyName = business?.company_name || "Your Service Provider";
    const tradesmanName = business?.tradesman_name || "";

    const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#ffffff;">
    <div style="padding:40px 40px 24px;border-bottom:3px solid #000000;">
      <h1 style="margin:0 0 6px;color:#000000;font-size:28px;font-weight:700;letter-spacing:-0.5px;">${companyName}</h1>
      <p style="margin:0;color:#000000;font-size:15px;font-weight:400;letter-spacing:0.03em;">JOB CARD #${job.job_card_number}</p>
    </div>
    <div style="padding:32px 40px;">
      <h2 style="margin:0 0 4px;color:#000000;font-size:20px;font-weight:700;">${job.title}</h2>
      ${job.purchase_order_number ? `<p style="margin:0 0 16px;color:#555555;font-size:14px;">PO: ${job.purchase_order_number}</p>` : ""}

      <div style="padding:16px;margin:20px 0;border:1px solid #000000;">
        <p style="margin:0 0 4px;font-size:11px;color:#000000;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">Client</p>
        <p style="margin:0;font-size:16px;color:#000000;font-weight:600;">${client.name}</p>
        ${client.company_name ? `<p style="margin:4px 0 0;font-size:14px;color:#000000;">${client.company_name}</p>` : ""}
        ${client.address ? `<p style="margin:4px 0 0;font-size:14px;color:#000000;">${client.address}</p>` : ""}
      </div>

      ${job.description ? `
      <div style="margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:11px;color:#000000;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">Description</p>
        <p style="margin:0;font-size:15px;color:#000000;line-height:1.6;">${job.description}</p>
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
          <tr>
            <td style="padding:5px 0;font-size:15px;color:#000000;">Labour Cost${hourlyRate > 0 ? ` <span style="font-size:12px;color:#555555;">($${hourlyRate.toFixed(2)}/hr)</span>` : ""}</td>
            <td style="padding:5px 0;font-size:15px;font-weight:700;color:#000000;text-align:right;">${hourlyRate > 0 ? `$${labourCost.toFixed(2)}` : "&mdash;"}</td>
          </tr>
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

      ${tradesmanName ? `<p style="margin:24px 0 0;font-size:14px;color:#000000;">Completed by ${tradesmanName}</p>` : ""}
    </div>
    <div style="padding:16px 40px;border-top:1px solid #000000;">
      <p style="margin:0;font-size:12px;color:#555555;text-align:center;">${companyName} &mdash; Job Card #${job.job_card_number}</p>
    </div>
  </div>
</body>
</html>`;

    const mailtrapToken = Deno.env.get("MAILTRAP_API_TOKEN");
    if (!mailtrapToken) {
      return new Response(JSON.stringify({ error: "MAILTRAP_API_TOKEN not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!business?.job_email) {
      return new Response(JSON.stringify({ error: "No job card email set in Business settings. Please add one before sending." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recipientEmail = business.job_email;

    const senderEmail = business?.job_email || recipientEmail;

    const mailtrapResponse = await fetch("https://send.api.mailtrap.io/api/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${mailtrapToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: { name: companyName, email: senderEmail },
        to: [{ email: recipientEmail }],
        subject: `Job Card #${job.job_card_number} - ${job.title}`,
        html: emailHtml,
      }),
    });

    const mailtrapRawText = await mailtrapResponse.text();

    if (!mailtrapResponse.ok) {
      let mailtrapError: unknown;
      try { mailtrapError = JSON.parse(mailtrapRawText); } catch { mailtrapError = mailtrapRawText; }
      const errObj = mailtrapError as Record<string, unknown>;
      const errorMessage =
        (typeof errObj?.message === "string" ? errObj.message : null) ||
        (Array.isArray(errObj?.errors) ? (errObj.errors as string[]).join(", ") : null) ||
        mailtrapRawText;
      return new Response(JSON.stringify({ error: errorMessage, details: mailtrapError }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase
      .from("jobs")
      .update({ email_sent: true, status: "completed" })
      .eq("id", jobId);

    return new Response(JSON.stringify({ success: true, sentTo: recipientEmail }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
