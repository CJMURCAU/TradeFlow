import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const OWNER_USER_ID = "4e2f5a9b-960e-4e02-9f92-e3e9c769ea31";
const OWNER_EMAIL = "simplejobtrademanager@gmail.com";

function generateSlug(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let slug = "";
  for (let i = 0; i < 10; i++) {
    slug += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return slug;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { visitorName, visitorEmail, message, slug } = await req.json();

    if (!visitorName || !message) {
      return new Response(JSON.stringify({ error: "Name and message are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let conversationId: string;
    let conversationSlug: string;

    if (slug) {
      const { data: existing } = await supabase
        .from("visitor_conversations")
        .select("id, slug")
        .eq("slug", slug)
        .maybeSingle();

      if (!existing) {
        return new Response(JSON.stringify({ error: "Conversation not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      conversationId = existing.id;
      conversationSlug = existing.slug;
    } else {
      let newSlug = generateSlug();
      let attempts = 0;
      while (attempts < 5) {
        const { data: existing } = await supabase
          .from("visitor_conversations")
          .select("id")
          .eq("slug", newSlug)
          .maybeSingle();
        if (!existing) break;
        newSlug = generateSlug();
        attempts++;
      }

      const { data: newConv, error: convError } = await supabase
        .from("visitor_conversations")
        .insert({
          visitor_name: visitorName,
          visitor_email: visitorEmail || null,
          slug: newSlug,
          owner_user_id: OWNER_USER_ID,
        })
        .select("id, slug")
        .single();

      if (convError || !newConv) {
        return new Response(JSON.stringify({ error: "Failed to create conversation" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      conversationId = newConv.id;
      conversationSlug = newConv.slug;
    }

    const { error: msgError } = await supabase
      .from("visitor_messages")
      .insert({
        conversation_id: conversationId,
        sender: "visitor",
        body: message,
        read_by_owner: false,
      });

    if (msgError) {
      return new Response(JSON.stringify({ error: "Failed to save message" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase
      .from("visitor_conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversationId);

    const mailtrapToken = Deno.env.get("MAILTRAP_API_TOKEN");
    if (mailtrapToken) {
      const appUrl = Deno.env.get("APP_URL") || "https://innovativetradetracker.com";
      const conversationLink = `${appUrl}/contact?conversation=${conversationSlug}`;

      const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="padding:32px 40px 24px;border-bottom:2px solid #F59E0B;">
      <h1 style="margin:0;color:#111827;font-size:22px;font-weight:700;">New visitor question</h1>
    </div>
    <div style="padding:32px 40px;">
      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
        <strong>${visitorName}</strong> has sent you a new message through your Contact Us page.
      </p>
      <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:0 0 24px;border:1px solid #e5e7eb;">
        <p style="margin:0;font-size:14px;color:#111827;line-height:1.6;">${message}</p>
      </div>
      ${visitorEmail ? `<p style="margin:0 0 16px;font-size:14px;color:#6b7280;">Visitor email: ${visitorEmail}</p>` : ""}
      <p style="margin:0 0 8px;font-size:14px;color:#374151;line-height:1.6;">
        Open the Innovative Trade Tracker app to read and reply to this message.
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
            from: { name: "Innovative Trade Tracker", email: "hello@innovativetradetracker.com" },
            to: [{ email: OWNER_EMAIL }],
            subject: `New question from ${visitorName}`,
            html: emailHtml,
          }),
        });
      } catch {
        // Email failure should not block the message from being saved
      }
    }

    return new Response(JSON.stringify({ success: true, slug: conversationSlug }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
