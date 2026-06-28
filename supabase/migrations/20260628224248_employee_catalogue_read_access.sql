-- Allow employees to read their employer's inventory catalogue
CREATE POLICY "employee_select_catalogue" ON inventory_catalogue
  FOR SELECT TO authenticated
  USING (
    user_id IN (
      SELECT owner_id FROM user_roles WHERE user_id = auth.uid()
    )
  );
