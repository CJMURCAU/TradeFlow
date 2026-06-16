/*
  # Prevent duplicate employee rows   [audit D-H2]

  A duplicate employee row (same person under the same owner, or one auth user
  linked to two employee rows) previously had to be hand-deleted in production
  and broke roleContext's .maybeSingle(). Add uniqueness so it can't recur.
*/

-- One employee per (owner, email).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM employees
    WHERE email <> ''
    GROUP BY user_id, lower(email)
    HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS employees_user_email_key
      ON employees (user_id, lower(email));
  ELSE
    RAISE NOTICE 'duplicate (user_id, lower(email)) employees exist; dedupe then add the unique index';
  END IF;
END $$;

-- One employee row per linked auth user.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM employees
    WHERE employee_user_id IS NOT NULL
    GROUP BY employee_user_id
    HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS employees_employee_user_id_key
      ON employees (employee_user_id)
      WHERE employee_user_id IS NOT NULL;
  ELSE
    RAISE NOTICE 'duplicate employee_user_id rows exist; dedupe then add the unique index';
  END IF;
END $$;
