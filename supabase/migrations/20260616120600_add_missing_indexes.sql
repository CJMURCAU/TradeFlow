/*
  # Add missing indexes   [audit D-H4 / D-M1 / D-M3]

  - jobs.user_id: the hottest filter (every owner query) and the MAX scan in
    next_job_card_number — was unindexed.
  - clients.user_id / business_details.user_id: owner-scoped lookups.
  - jobs.scheduled_time: dropped in 20260409033236 and never restored; the
    calendar/dashboard date queries scan without it.
  - parts.employee_id / time_entries.employee_id / job_employee_notes.employee_id:
    FKs added after the earlier index migrations and never covered.
*/

CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs (user_id);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients (user_id);
CREATE INDEX IF NOT EXISTS idx_business_details_user_id ON business_details (user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_time ON jobs (scheduled_time);
CREATE INDEX IF NOT EXISTS idx_parts_employee_id ON parts (employee_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_employee_id ON time_entries (employee_id);
CREATE INDEX IF NOT EXISTS idx_job_employee_notes_employee_id ON job_employee_notes (employee_id);
