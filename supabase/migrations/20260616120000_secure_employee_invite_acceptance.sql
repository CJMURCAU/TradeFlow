/*
  # Secure employee invite acceptance   [audit S-C2 / S-C3]

  Problem: accept_employee_invite(p_token, p_user_id) trusted a client-supplied
  user id and could bind an invite (or a user_roles row) to ANY user. Tokens
  were also never expired or invalidated.

  Fix:
  - Derive the user from auth.uid() inside the SECURITY DEFINER function; the
    caller can no longer name an arbitrary id.
  - Honour an expiry (invite_token_expires_at) and make tokens single-use by
    clearing them on acceptance.
*/

ALTER TABLE employees ADD COLUMN IF NOT EXISTS invite_token_expires_at timestamptz;

-- Drop the old, unsafe two-argument version.
DROP FUNCTION IF EXISTS accept_employee_invite(text, uuid);

CREATE OR REPLACE FUNCTION accept_employee_invite(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee employees%ROWTYPE;
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_employee
  FROM employees
  WHERE invite_token = p_token
    AND employee_user_id IS NULL
    AND (invite_token_expires_at IS NULL OR invite_token_expires_at > now())
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Invalid, expired, or already used token');
  END IF;

  -- Link to the authenticated caller and invalidate the token (single-use).
  UPDATE employees
  SET employee_user_id = v_uid,
      status = 'active',
      invite_token = NULL,
      invite_token_expires_at = NULL
  WHERE id = v_employee.id;

  INSERT INTO user_roles (user_id, role, owner_id)
  VALUES (v_uid, 'employee', v_employee.user_id)
  ON CONFLICT (user_id) DO UPDATE
    SET role = 'employee',
        owner_id = v_employee.user_id;

  RETURN json_build_object('success', true, 'owner_id', v_employee.user_id);
END;
$$;

REVOKE ALL ON FUNCTION accept_employee_invite(text) FROM public;
GRANT EXECUTE ON FUNCTION accept_employee_invite(text) TO authenticated;
