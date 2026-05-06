/*
  # Fix orphaned business_details row and duplicate employee record

  ## Changes

  1. Delete orphaned business_details row
     - Removes the row with user_id = null (id: 02f779ca-a4a0-4715-b409-ee00716cdb20)
     - This row could never be updated due to RLS requiring user_id = auth.uid()
     - The correct row (id: 09ec34cd) with a valid user_id remains untouched

  2. Delete duplicate employee record for Toby
     - Removes the duplicate row (id: f884857b-bced-411e-b33a-4244d8811298)
       which belongs to owner 34f63d70 but shares employee_user_id with Toby's
       correct record under owner f1a69cc6
     - The duplicate caused .maybeSingle() in roleContext to return null
       (multiple rows matched), hiding the Costs section and client address
     - Toby's correct record (id: 4f7fad00) under owner f1a69cc6 is kept
*/

DELETE FROM business_details WHERE id = '02f779ca-a4a0-4715-b409-ee00716cdb20' AND user_id IS NULL;

DELETE FROM employees WHERE id = 'f884857b-bced-411e-b33a-4244d8811298';
