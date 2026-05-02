/*
  # Change guest trial duration from 30 days to 2 days

  Changes the default value of expires_at on guest_sessions from
  now() + 30 days to now() + 2 days. Existing sessions are not affected.
*/

ALTER TABLE guest_sessions
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '2 days');
