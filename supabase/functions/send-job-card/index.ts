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

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const timeFormatted = `${hours}h ${minutes}m`;

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
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:#F59E0B;padding:32px 40px;">
      <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">${companyName}</h1>
      <p style="margin:8px 0 0;color:#fffbeb;font-size:16px;">Job Card #${job.job_card_number}</p>
    </div>
    <div style="padding:32px 40px;">
      <h2 style="margin:0 0 4px;color:#111827;font-size:20px;">${job.title}</h2>
      ${job.purchase_order_number ? `<p style="margin:0 0 16px;color:#6b7280;font-size:14px;">PO: ${job.purchase_order_number}</p>` : ""}

      <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:20px 0;border:1px solid #e5e7eb;">
        <p style="margin:0 0 4px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Client</p>
        <p style="margin:0;font-size:16px;color:#111827;font-weight:600;">${client.name}</p>
        ${client.company_name ? `<p style="margin:4px 0 0;font-size:14px;color:#374151;">${client.company_name}</p>` : ""}
        ${client.address ? `<p style="margin:4px 0 0;font-size:14px;color:#374151;">${client.address}</p>` : ""}
      </div>

      ${job.description ? `
      <div style="margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Description</p>
        <p style="margin:0;font-size:15px;color:#374151;line-height:1.6;">${job.description}</p>
      </div>` : ""}

      <div style="margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Parts Used</p>
        ${partsHtml}
      </div>

      <div style="background:#f9fafb;border-radius:8px;padding:16px;border:1px solid #e5e7eb;">
        <p style="margin:0 0 8px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Summary</p>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
          <span style="font-size:15px;color:#374151;">Total Parts Cost</span>
          <span style="font-size:15px;font-weight:600;color:#111827;">$${totalPartsCost.toFixed(2)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="font-size:15px;color:#374151;">Total Time</span>
          <span style="font-size:15px;font-weight:600;color:#111827;">${timeFormatted}</span>
        </div>
      </div>

      ${tradesmanName ? `<p style="margin:24px 0 0;font-size:14px;color:#6b7280;">Completed by ${tradesmanName}</p>` : ""}
    </div>
    <div style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;">
      <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;">${companyName} &mdash; Job Card #${job.job_card_number}</p>
    </div>
  </div>
</body>
</html>`;

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
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

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${companyName} <onboarding@resend.dev>`,
        to: [recipientEmail],
        subject: `Job Card #${job.job_card_number} - ${job.title}`,
        html: emailHtml,
        reply_to: recipientEmail,
      }),
    });

    if (!resendResponse.ok) {
      const resendError = await resendResponse.json();
      const errorMessage = resendError?.message || resendError?.name || JSON.stringify(resendError);
      return new Response(JSON.stringify({ error: errorMessage, details: resendError }), {
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
