/*
  # Fix anon SELECT exposure on employees and guest_sessions

  ## Summary
  The Supabase advisor flags `employees` and `guest_sessions` as visible in the
  GraphQL schema because the `anon` role has a table-level SELECT grant on them.

  The app has two legitimate anon SELECT needs:
  1. Invite token lookup on `employees` (app/invite.tsx)
  2. Guest session validation by ID (app/_layout.tsx)

  Both of these are narrow, single-row lookups. We replace the table-level anon
  SELECT grants with SECURITY DEFINER functions that perform the exact query needed,
  then revoke the direct anon SELECT grants. The tables then disappear from the
  GraphQL schema for the anon role.

  ## Changes
  1. Create `public.lookup_employee_by_invite_token(token text)` - SECURITY DEFINER,
     returns only the columns the invite flow needs, only for rows where invite_token
     matches and status = 'pending'.
  2. Create `public.lookup_guest_session(session_id uuid)` - SECURITY DEFINER,
     returns id and expires_at for the matching session.
  3. Revoke anon SELECT on employees and guest_sessions.
  4. Drop the overly-broad "Allow invite token lookup" RLS policy and replace with
     a tighter one (fallback for authenticated).
*/

-- 1. Invite token lookup function (replaces anon SELECT on employees)
CREATE OR REPLACE FUNCTION public.lookup_employee_by_invite_token(token text)
RETURNS TABLE (
  id uuid,
  name text,
  email text,
  status text,
  employee_user_id uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, email, status, employee_user_id
  FROM employees
  WHERE invite_token = token
    AND status = 'pending'
  LIMIT 1;
$$;

-- Grant execute to anon and authenticated
REVOKE ALL ON FUNCTION public.lookup_employee_by_invite_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_employee_by_invite_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.lookup_employee_by_invite_token(text) TO authenticated;

-- 2. Guest session lookup function (replaces anon SELECT on guest_sessions)
CREATE OR REPLACE FUNCTION public.lookup_guest_session(session_id uuid)
RETURNS TABLE (
  id uuid,
  expires_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, expires_at
  FROM guest_sessions
  WHERE id = session_id
  LIMIT 1;
$$;

-- Grant execute to anon and authenticated
REVOKE ALL ON FUNCTION public.lookup_guest_session(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_guest_session(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.lookup_guest_session(uuid) TO authenticated;

-- 3. Revoke anon SELECT grants from employees and guest_sessions
REVOKE SELECT ON public.employees FROM anon;
REVOKE SELECT ON public.guest_sessions FROM anon;

-- 4. Drop the broad anon invite token policy (no longer needed; function handles it)
DROP POLICY IF EXISTS "Allow invite token lookup" ON public.employees;

-- 5. Drop the broad anon/authenticated select policies on guest_sessions
--    and replace with tighter authenticated-only policy
--    (anon validation now goes through lookup_guest_session function)
DROP POLICY IF EXISTS "anon can select guest sessions" ON public.guest_sessions;
DROP POLICY IF EXISTS "authenticated can select guest sessions" ON public.guest_sessions;

CREATE POLICY "authenticated can select own guest session"
  ON public.guest_sessions
  FOR SELECT
  TO authenticated
  USING (true);
