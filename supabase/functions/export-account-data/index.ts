import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Export all of the caller's data as JSON (audit: GDPR right of access /
// portability). Verifies the caller and returns only their own rows.

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

    const jobsRes = await admin.from("jobs").select("*").eq("user_id", userId);
    const jobIds = (jobsRes.data || []).map((j: { id: string }) => j.id);

    const [clients, business, employees, parts, timeEntries, assignments, notes, notifications, noteItems] =
      await Promise.all([
        admin.from("clients").select("*").eq("user_id", userId),
        admin.from("business_details").select("*").eq("user_id", userId),
        admin.from("employees").select("*").eq("user_id", userId),
        jobIds.length ? admin.from("parts").select("*").in("job_id", jobIds) : Promise.resolve({ data: [] }),
        jobIds.length ? admin.from("time_entries").select("*").in("job_id", jobIds) : Promise.resolve({ data: [] }),
        jobIds.length ? admin.from("job_assignments").select("*").in("job_id", jobIds) : Promise.resolve({ data: [] }),
        jobIds.length ? admin.from("job_employee_notes").select("*").in("job_id", jobIds) : Promise.resolve({ data: [] }),
        admin.from("employee_notifications").select("*").eq("recipient_user_id", userId),
        admin.from("note_items").select("*").eq("user_id", userId),
      ]);

    const exportedAt = new Date().toISOString();
    return json({
      exported_at: exportedAt,
      account: { id: user.id, email: user.email },
      business_details: business.data ?? [],
      clients: clients.data ?? [],
      jobs: jobsRes.data ?? [],
      parts: parts.data ?? [],
      time_entries: timeEntries.data ?? [],
      employees: employees.data ?? [],
      job_assignments: assignments.data ?? [],
      job_employee_notes: notes.data ?? [],
      employee_notifications: notifications.data ?? [],
      note_items: noteItems.data ?? [],
    }, 200, req);
  } catch (err) {
    console.error("export-account-data: unexpected error", err);
    return json({ error: "Something went wrong. Please try again." }, 500, req);
  }
});
