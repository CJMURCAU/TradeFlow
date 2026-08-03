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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const { conversationId, replyText } = await req.json();
    if (!conversationId || !replyText) {
      return new Response(JSON.stringify({ error: "conversationId and replyText are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: conversation } = await supabase
      .from("visitor_conversations")
      .select("*")
      .eq("id", conversationId)
      .maybeSingle();

    if (!conversation || conversation.owner_user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Conversation not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: business } = await supabase
      .from("business_details")
      .select("company_name, tradesman_name")
      .eq("user_id", user.id)
      .maybeSingle();

    const companyName = business?.company_name || business?.tradesman_name || "Innovative Trade Tracker";

    const { error: msgError } = await supabase
      .from("visitor_messages")
      .insert({
        conversation_id: conversationId,
        sender: "owner",
        body: replyText,
        read_by_owner: true,
      });

    if (msgError) {
      return new Response(JSON.stringify({ error: "Failed to save reply" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase
      .from("visitor_conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversationId);

    if (conversation.visitor_email) {
      const mailtrapToken = Deno.env.get("MAILTRAP_API_TOKEN");
      if (mailtrapToken) {
        const appUrl = "https://innovativetradetracker.com";
        const conversationLink = `${appUrl}/contact?conversation=${conversation.slug}`;

        const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="padding:32px 40px 24px;border-bottom:2px solid #F59E0B;">
      <h1 style="margin:0;color:#111827;font-size:22px;font-weight:700;">Reply from ${companyName}</h1>
    </div>
    <div style="padding:32px 40px;">
      <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:0 0 24px;border:1px solid #e5e7eb;">
        <p style="margin:0;font-size:14px;color:#111827;line-height:1.6;">${replyText}</p>
      </div>
      <a href="${conversationLink}" style="display:inline-block;background:#F59E0B;color:#ffffff;font-size:15px;font-weight:700;padding:14px 28px;border-radius:8px;text-decoration:none;">View conversation</a>
      <p style="margin:16px 0 0;font-size:13px;color:#6b7280;line-height:1.6;">
        Or copy this link into your browser:<br>
        <span style="color:#111827;word-break:break-all;">${conversationLink}</span>
      </p>
    </div>
  </div>
</body>
</html>`;

        try {
          await fetch("https://send.api.mailtrap.io/api/send", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${mailtrapToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: { name: companyName, email: "hello@innovativetradetracker.com" },
              to: [{ email: conversation.visitor_email }],
              subject: `Reply from ${companyName}`,
              html: emailHtml,
            }),
          });
        } catch {
          // Email failure should not block the reply from being saved
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
