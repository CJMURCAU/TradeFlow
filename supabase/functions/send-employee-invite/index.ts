import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 48; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify the caller is authenticated
    const userSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await userSupabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { employeeId, appUrl: clientAppUrl } = await req.json();
    if (!employeeId) {
      return new Response(JSON.stringify({ error: "employeeId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the employee record (must belong to the calling owner)
    const { data: employee, error: empError } = await supabase
      .from("employees")
      .select("*")
      .eq("id", employeeId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (empError || !employee) {
      return new Response(JSON.stringify({ error: "Employee not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get business details for personalisation
    const { data: business } = await supabase
      .from("business_details")
      .select("company_name, tradesman_name")
      .eq("user_id", user.id)
      .maybeSingle();

    const companyName = business?.company_name || business?.tradesman_name || "Your employer";

    // Generate/reuse invite token
    let token = employee.invite_token;
    if (!token) {
      token = generateToken();
      await supabase
        .from("employees")
        .update({ invite_token: token })
        .eq("id", employeeId);
    }

    const appUrl = clientAppUrl || "https://tradeflow.app";
    const inviteLink = `${appUrl}/invite?token=${token}`;

    const mailtrapToken = Deno.env.get("MAILTRAP_API_TOKEN");
    if (!mailtrapToken) {
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const senderEmail = business ? (
      await supabase
        .from("business_details")
        .select("job_email")
        .eq("user_id", user.id)
        .maybeSingle()
    ).data?.job_email || "noreply@tradeflow.app" : "noreply@tradeflow.app";

    const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="padding:32px 40px 24px;border-bottom:2px solid #F59E0B;">
      <h1 style="margin:0;color:#111827;font-size:22px;font-weight:700;">You've been invited to TradeFlow</h1>
    </div>
    <div style="padding:32px 40px;">
      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
        Hi ${employee.name},
      </p>
      <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
        <strong>${companyName}</strong> has invited you to join TradeFlow as an employee. You'll be able to view and manage jobs assigned to you.
      </p>
      <a href="${inviteLink}" style="display:inline-block;background:#F59E0B;color:#ffffff;font-size:15px;font-weight:700;padding:14px 28px;border-radius:8px;text-decoration:none;">Accept Invitation</a>
      <p style="margin:24px 0 0;font-size:13px;color:#6b7280;line-height:1.6;">
        Or copy this link into your browser:<br>
        <span style="color:#111827;word-break:break-all;">${inviteLink}</span>
      </p>
      <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">
        If you weren't expecting this invitation, you can safely ignore this email.
      </p>
    </div>
  </div>
</body>
</html>`;

    const mailtrapResponse = await fetch("https://send.api.mailtrap.io/api/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${mailtrapToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: { name: companyName, email: senderEmail },
        to: [{ email: employee.email }],
        subject: `${companyName} has invited you to TradeFlow`,
        html: emailHtml,
      }),
    });

    if (!mailtrapResponse.ok) {
      const errText = await mailtrapResponse.text();
      return new Response(JSON.stringify({ error: "Failed to send email", details: errText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, sentTo: employee.email }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
