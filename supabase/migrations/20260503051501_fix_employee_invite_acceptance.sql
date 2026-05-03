/*
  # Fix employee invite acceptance

  ## Problem
  When an employee accepts an invite, the UPDATE RLS policy on the employees table
  checks `employee_user_id = auth.uid()`. But at the moment of acceptance,
  `employee_user_id` is NULL, so the policy never matches and the update silently fails.

  ## Solution
  Add a security-definer function `accept_employee_invite` that:
  1. Verifies the invite token matches an unlinked employee row
  2. Updates the employee row to set employee_user_id and status = 'active'
  3. Upserts the user_roles row
  
  This runs with elevated (definer) privileges, bypassing the RLS deadlock.
  The function is accessible to authenticated users only.
*/

CREATE OR REPLACE FUNCTION accept_employee_invite(p_token text, p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee employees%ROWTYPE;
BEGIN
  -- Find the unlinked employee with this token
  SELECT * INTO v_employee
  FROM employees
  WHERE invite_token = p_token
    AND employee_user_id IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or already used token');
  END IF;

  -- Link the employee to the auth user
  UPDATE employees
  SET employee_user_id = p_user_id,
      status = 'active'
  WHERE id = v_employee.id;

  -- Upsert the role record
  INSERT INTO user_roles (user_id, role, owner_id)
  VALUES (p_user_id, 'employee', v_employee.user_id)
  ON CONFLICT (user_id) DO UPDATE
    SET role = 'employee',
        owner_id = v_employee.user_id;

  RETURN json_build_object('success', true, 'owner_id', v_employee.user_id);
END;
$$;

-- Only authenticated users can call this
REVOKE ALL ON FUNCTION accept_employee_invite(text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION accept_employee_invite(text, uuid) TO authenticated;
