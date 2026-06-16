import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Server-side account deletion (audit S-C5). The app previously called
// supabase.auth.admin.deleteUser from the client with the anon key, which
// silently fails — leaving an orphaned auth user and (a GDPR erasure failure).
// Here we verify the caller, delete all of their data with the service role,
// then delete the auth user.

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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401, req);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401, req);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const userId = user.id;

    // Explicit deletes in dependency order. (FK ON DELETE CASCADE from
    // auth.users would also cover most of this, but we don't rely on it being
    // present on every environment.)
    const jobsRes = await admin.from("jobs").select("id").eq("user_id", userId);
    const jobIds = (jobsRes.data || []).map((j: { id: string }) => j.id);
    if (jobIds.length > 0) {
      await admin.from("parts").delete().in("job_id", jobIds);
      await admin.from("time_entries").delete().in("job_id", jobIds);
      await admin.from("job_assignments").delete().in("job_id", jobIds);
      await admin.from("job_employee_notes").delete().in("job_id", jobIds);
    }
    await admin.from("jobs").delete().eq("user_id", userId);
    await admin.from("clients").delete().eq("user_id", userId);
    await admin.from("business_details").delete().eq("user_id", userId);
    await admin.from("employees").delete().eq("user_id", userId);
    await admin.from("note_items").delete().eq("user_id", userId);
    await admin.from("employee_notifications").delete().eq("recipient_user_id", userId);
    await admin.from("user_roles").delete().eq("user_id", userId);

    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) {
      console.error("delete-account: auth user delete failed", delErr);
      return json({ error: "Could not delete your account. Please contact support." }, 500, req);
    }

    return json({ success: true }, 200, req);
  } catch (err) {
    console.error("delete-account: unexpected error", err);
    return json({ error: "Something went wrong. Please try again." }, 500, req);
  }
});
