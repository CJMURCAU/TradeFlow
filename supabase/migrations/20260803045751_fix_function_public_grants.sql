-- Revoke PUBLIC grants that include anon role implicitly
REVOKE EXECUTE ON FUNCTION public.next_job_card_number(owner_user_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_job_photo_limit() FROM PUBLIC;

-- Ensure anon still can't execute next_job_card_number
REVOKE EXECUTE ON FUNCTION public.next_job_card_number(owner_user_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_job_photo_limit() FROM anon;
