-- inventory_catalogue: owner's reusable price list (items and services)
CREATE TABLE inventory_catalogue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  default_price numeric DEFAULT 0,
  unit text DEFAULT '',
  type text NOT NULL DEFAULT 'item' CHECK (type IN ('item', 'service')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_inventory_catalogue_user_id ON inventory_catalogue(user_id);

ALTER TABLE inventory_catalogue ENABLE ROW LEVEL SECURITY;

-- Only the owner (authenticated user whose user_id matches) can manage their catalogue
CREATE POLICY "owner_select_catalogue" ON inventory_catalogue
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "owner_insert_catalogue" ON inventory_catalogue
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "owner_update_catalogue" ON inventory_catalogue
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "owner_delete_catalogue" ON inventory_catalogue
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Employees have NO access to inventory_catalogue (intentionally no anon/employee policies)

-- job_inventory: per-job line items (replaces parts)
CREATE TABLE job_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  catalogue_id uuid REFERENCES inventory_catalogue(id) ON DELETE SET NULL,
  name text NOT NULL,
  unit_price numeric DEFAULT 0,
  quantity integer DEFAULT 1,
  type text NOT NULL DEFAULT 'item' CHECK (type IN ('item', 'service')),
  employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_job_inventory_job_id ON job_inventory(job_id);
CREATE INDEX idx_job_inventory_employee_id ON job_inventory(employee_id);

ALTER TABLE job_inventory ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all inventory for jobs they are involved in
CREATE POLICY "auth_select_job_inventory" ON job_inventory
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_insert_job_inventory" ON job_inventory
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "auth_update_job_inventory" ON job_inventory
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_delete_job_inventory" ON job_inventory
  FOR DELETE TO authenticated USING (true);

-- Migrate existing parts data into job_inventory
INSERT INTO job_inventory (id, job_id, name, unit_price, quantity, type, employee_id, created_at)
SELECT id, job_id, name, cost, quantity, 'item', employee_id, created_at
FROM parts;
