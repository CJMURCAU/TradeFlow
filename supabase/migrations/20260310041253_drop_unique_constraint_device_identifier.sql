/*
  # Drop unique constraint on guest_sessions.device_identifier

  ## Summary
  Removes the UNIQUE constraint on the device_identifier column of the guest_sessions table.
  This constraint was incorrectly blocking new guest sessions because all web users were
  being assigned the same device_identifier value ('web'), causing insert failures after
  the first session was created.

  ## Changes
  - Drops the unique index/constraint `guest_sessions_device_identifier_key` on guest_sessions.device_identifier
  - The non-unique index `idx_guest_sessions_device_identifier` is retained for query performance

  ## Notes
  - The app code will be updated separately to generate a proper unique device identifier
    per device/browser, making device_identifier meaningful again
*/

ALTER TABLE guest_sessions DROP CONSTRAINT IF EXISTS guest_sessions_device_identifier_key;
