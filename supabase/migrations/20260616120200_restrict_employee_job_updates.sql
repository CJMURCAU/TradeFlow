/*
  # Restrict employee job updates to the status column   [audit S-H3]

  Problem: the "Employees can update status on assigned jobs" policy grants
  row-level UPDATE, but RLS cannot scope to a single column — so an assigned
  employee could rewrite title, client_id, job_card_number, etc.

  Fix: a BEFORE UPDATE trigger that allows the job's owner to change anything,
  but for anyone else (an assigned employee) rejects the update unless ONLY the
  status column changed. No app changes required; owners are unaffected.
*/

CREATE OR REPLACE FUNCTION enforce_employee_job_update_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Owner (or service role / no JWT context, e.g. migrations) may change anything.
  IF auth.uid() IS NULL OR NEW.user_id = auth.uid() THEN
    RETURN NEW;
  END IF;

  -- Otherwise only the status column may differ.
  IF NEW.user_id            IS DISTINCT FROM OLD.user_id
     OR NEW.client_id       IS DISTINCT FROM OLD.client_id
     OR NEW.title           IS DISTINCT FROM OLD.title
     OR NEW.purchase_order_number IS DISTINCT FROM OLD.purchase_order_number
     OR NEW.description     IS DISTINCT FROM OLD.description
     OR NEW.scheduled_time  IS DISTINCT FROM OLD.scheduled_time
     OR NEW.job_card_number IS DISTINCT FROM OLD.job_card_number
     OR NEW.email_sent      IS DISTINCT FROM OLD.email_sent
     OR NEW.created_at       IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Employees may only change job status';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_employee_job_update ON jobs;
CREATE TRIGGER trg_enforce_employee_job_update
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION enforce_employee_job_update_columns();
