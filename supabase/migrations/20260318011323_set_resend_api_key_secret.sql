/*
  # Store Resend API key in Supabase Vault

  Stores the Resend API key so the send-job-card edge function can access it
  via Deno.env.get('RESEND_API_KEY').
*/

SELECT vault.create_secret('re_SuWRAoRM_MEuE1oLiZxZfrUNiEgi14U7b', 'RESEND_API_KEY', 'Resend email API key for sending job card emails');
