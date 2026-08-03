-- check_job_photo_limit is a trigger function — it doesn't need SECURITY DEFINER
-- (it runs in the context of the table owner). Revert to SECURITY INVOKER but
-- keep the fixed search_path.
ALTER FUNCTION public.check_job_photo_limit()
  SECURITY INVOKER SET search_path = public;

-- Re-revoke anon EXECUTE on next_job_card_number (ALTER may have reset grants)
REVOKE EXECUTE ON FUNCTION public.next_job_card_number(owner_user_id uuid) FROM anon;

-- Also revoke anon EXECUTE on check_job_photo_limit since it's a trigger, not an RPC
REVOKE EXECUTE ON FUNCTION public.check_job_photo_limit() FROM anon;
