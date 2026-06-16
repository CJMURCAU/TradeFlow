/*
  # Store the email-provider API key in Supabase Vault

  SECURITY NOTE (audit S-C4):
  A live API key was previously hard-coded in this migration and committed to
  git. That key MUST be treated as compromised: rotate/revoke it in the
  provider dashboard immediately. Never commit secrets to version control.

  Secrets are now provisioned out-of-band, not in migrations. Set them with:

    supabase secrets set RESEND_API_KEY=...        # for edge functions (Deno.env)

  or, if a DB-side vault secret is genuinely required, create it manually via
  the Supabase dashboard / SQL editor (not in a tracked migration):

    select vault.create_secret('<rotated-key>', 'RESEND_API_KEY', 'Email API key');

  This migration is intentionally a no-op so the schema remains reproducible
  without leaking a credential.
*/

-- no-op: secret provisioning moved out of version control (see note above)
SELECT 1;
