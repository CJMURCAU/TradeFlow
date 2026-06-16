/*
  # Lock down user_roles writes   [audit S-H4]

  Problem: "Users can insert/update own role" only checked auth.uid() = user_id,
  so a user could set their own role/owner_id to arbitrary values (tenant/role
  spoofing).

  Fix: remove the self-write policies and replace the app's owner self-creation
  with a SECURITY DEFINER function that can ONLY ever create an 'owner' row for
  the caller themselves. Role/owner assignment otherwise happens only through
  accept_employee_invite. SELECT policies are unchanged.
*/

DROP POLICY IF EXISTS "Users can insert own role" ON user_roles;
DROP POLICY IF EXISTS "Users can update own role" ON user_roles;

CREATE OR REPLACE FUNCTION ensure_owner_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_role text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT role INTO v_role FROM user_roles WHERE user_id = v_uid;
  IF v_role IS NULL THEN
    -- Only ever creates an owner row for the caller; cannot set owner_id to
    -- someone else or assign the 'employee' role.
    INSERT INTO user_roles (user_id, role, owner_id)
    VALUES (v_uid, 'owner', v_uid)
    ON CONFLICT (user_id) DO NOTHING;
    SELECT role INTO v_role FROM user_roles WHERE user_id = v_uid;
  END IF;

  RETURN v_role;
END;
$$;

REVOKE ALL ON FUNCTION ensure_owner_role() FROM public;
GRANT EXECUTE ON FUNCTION ensure_owner_role() TO authenticated;
