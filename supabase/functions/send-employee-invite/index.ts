import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// --- CORS (audit S-H2): allow-list origins instead of "*" -------------------
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ??
  "https://tradeflowmanager.com,http://localhost:8081,http://localhost:19006")
  .split(",")
  .map((o) => o.trim())
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

function json(body: unknown, status: number, req: Request): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

// --- HTML escaping (audit S-M2) ---------------------------------------------
function esc(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// --- Cryptographically-secure invite token (audit S-C3) ---------------------
function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Only allow invite links pointing at a known origin (audit S-M2) ------------
function safeAppUrl(candidate: unknown): string {
  const fallback = ALLOWED_ORIGINS[0];
  if (typeof candidate !== "string") return fallback;
  try {
    const u = new URL(candidate);
    return ALLOWED_ORIGINS.includes(u.origin) ? u.origin : fallback;
  } catch {
    return fallback;
  }
}

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders(req) });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Unauthorized" }, 401, req);
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
      return json({ error: "Unauthorized" }, 401, req);
    }

    const { employeeId, appUrl: clientAppUrl } = await req.json();
    if (!employeeId) {
      return json({ error: "employeeId is required" }, 400, req);
    }

    // Fetch the employee record (must belong to the calling owner)
    const { data: employee, error: empError } = await supabase
      .from("employees")
      .select("*")
      .eq("id", employeeId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (empError || !employee) {
      return json({ error: "Employee not found" }, 404, req);
    }

    // Get business details for personalisation
    const { data: business } = await supabase
      .from("business_details")
      .select("company_name, tradesman_name")
      .eq("user_id", user.id)
      .maybeSingle();

    const companyName = business?.company_name || business?.tradesman_name || "Your employer";

    // Generate a fresh token if none exists or the existing one has expired
    // (audit S-C3: short-lived, CSPRNG tokens).
    const now = Date.now();
    const existingExpiry = employee.invite_token_expires_at
      ? new Date(employee.invite_token_expires_at).getTime()
      : 0;
    let token: string = employee.invite_token;
    if (!token || existingExpiry < now) {
      token = generateToken();
      const expiresAt = new Date(now + TOKEN_TTL_MS).toISOString();
      const { error: updErr } = await supabase
        .from("employees")
        .update({ invite_token: token, invite_token_expires_at: expiresAt })
        .eq("id", employeeId);
      if (updErr) {
        console.error("send-employee-invite: token persist failed", updErr);
        return json({ error: "Could not create the invite. Please try again." }, 500, req);
      }
    }

    const inviteLink = `${safeAppUrl(clientAppUrl)}/invite?token=${token}`;

    const mailtrapToken = Deno.env.get("MAILTRAP_API_TOKEN");
    if (!mailtrapToken) {
      console.error("send-employee-invite: MAILTRAP_API_TOKEN not configured");
      return json({ error: "Email is not configured. Please contact support." }, 500, req);
    }

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
        Hi ${esc(employee.name)},
      </p>
      <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
        <strong>${esc(companyName)}</strong> has invited you to join TradeFlow as an employee. You'll be able to view and manage jobs assigned to you.
      </p>
      <a href="${esc(inviteLink)}" style="display:inline-block;background:#F59E0B;color:#ffffff;font-size:15px;font-weight:700;padding:14px 28px;border-radius:8px;text-decoration:none;">Accept Invitation</a>
      <p style="margin:24px 0 0;font-size:13px;color:#6b7280;line-height:1.6;">
        Or copy this link into your browser:<br>
        <span style="color:#111827;word-break:break-all;">${esc(inviteLink)}</span>
      </p>
      <p style="margin:8px 0 0;font-size:12px;color:#9ca3af;">This invitation expires in 7 days.</p>
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
        from: { name: companyName, email: "hello@tradeflowmanager.com" },
        to: [{ email: employee.email }],
        subject: `${companyName} has invited you to TradeFlow`,
        html: emailHtml,
      }),
    });

    if (!mailtrapResponse.ok) {
      const detail = await mailtrapResponse.text();
      console.error("send-employee-invite: email provider error", mailtrapResponse.status, detail);
      return json({ error: "Failed to send the invitation email. Please try again." }, 502, req);
    }

    return json({ success: true, sentTo: employee.email }, 200, req);
  } catch (err) {
    console.error("send-employee-invite: unexpected error", err);
    return json({ error: "Something went wrong. Please try again." }, 500, req);
  }
});
