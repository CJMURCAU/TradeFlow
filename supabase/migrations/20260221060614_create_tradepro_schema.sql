/*
  # TradePro Database Schema

  ## Overview
  Creates the complete database schema for TradePro - a tradesman management app.
  
  ## New Tables
  
  ### 1. clients
  - `id` (uuid, primary key) - Unique identifier for each client
  - `name` (text) - Client's full name
  - `phone` (text) - Contact phone number
  - `email` (text) - Email address
  - `address` (text) - Physical address (can be linked with Google Maps)
  - `created_at` (timestamptz) - Record creation timestamp
  
  ### 2. jobs
  - `id` (uuid, primary key) - Unique identifier for each job
  - `client_id` (uuid, foreign key) - Reference to clients table
  - `title` (text) - Job title/name
  - `purchase_order_number` (text) - PO number for tracking
  - `description` (text) - Detailed job description
  - `status` (text) - Job status: 'pending', 'active', 'completed'
  - `scheduled_time` (timestamptz) - When the job is scheduled
  - `job_card_number` (integer) - Auto-incrementing job card number starting from 1000
  - `email_sent` (boolean) - Whether job card email has been sent
  - `created_at` (timestamptz) - Record creation timestamp
  
  ### 3. parts
  - `id` (uuid, primary key) - Unique identifier for each part
  - `job_id` (uuid, foreign key) - Reference to jobs table
  - `name` (text) - Part name/description
  - `cost` (numeric) - Cost per unit
  - `quantity` (integer) - Quantity used
  - `created_at` (timestamptz) - Record creation timestamp
  
  ### 4. time_entries
  - `id` (uuid, primary key) - Unique identifier for each time entry
  - `job_id` (uuid, foreign key) - Reference to jobs table
  - `start_time` (timestamptz) - When timer started
  - `end_time` (timestamptz) - When timer stopped (null if running)
  - `is_running` (boolean) - Whether timer is currently active
  - `created_at` (timestamptz) - Record creation timestamp
  
  ### 5. business_details
  - `id` (uuid, primary key) - Unique identifier
  - `company_name` (text) - Business/company name
  - `tradesman_name` (text) - Tradesman's name
  - `job_email` (text) - Email for sending job cards
  - `default_hourly_rate` (numeric) - Default hourly rate for jobs
  - `created_at` (timestamptz) - Record creation timestamp
  
  ## Security
  - Enable RLS on all tables
  - Add policies for authenticated users to manage all records
  - All tables are fully accessible to authenticated users (single-user app)
  
  ## Notes
  - Job card numbers auto-increment starting from 1000
  - Time entries track start/stop/pause functionality
  - All foreign keys have CASCADE delete for data integrity
*/

-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text DEFAULT '',
  email text DEFAULT '',
  address text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Create jobs table with auto-incrementing job_card_number
CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  title text NOT NULL,
  purchase_order_number text DEFAULT '',
  description text DEFAULT '',
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed')),
  scheduled_time timestamptz,
  job_card_number serial NOT NULL,
  email_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Set the starting value for job_card_number to 1000
ALTER SEQUENCE jobs_job_card_number_seq RESTART WITH 1000;

-- Create parts table
CREATE TABLE IF NOT EXISTS parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES jobs(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  cost numeric DEFAULT 0,
  quantity integer DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- Create time_entries table
CREATE TABLE IF NOT EXISTS time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES jobs(id) ON DELETE CASCADE NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  is_running boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create business_details table
CREATE TABLE IF NOT EXISTS business_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text DEFAULT '',
  tradesman_name text DEFAULT '',
  job_email text DEFAULT '',
  default_hourly_rate numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Insert default business details record
INSERT INTO business_details (company_name, tradesman_name, job_email, default_hourly_rate)
VALUES ('', '', '', 0)
ON CONFLICT DO NOTHING;

-- Enable Row Level Security
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_details ENABLE ROW LEVEL SECURITY;

-- Create policies for clients
CREATE POLICY "Allow all operations on clients"
  ON clients FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public read on clients"
  ON clients FOR SELECT
  TO anon
  USING (true);

-- Create policies for jobs
CREATE POLICY "Allow all operations on jobs"
  ON jobs FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public read on jobs"
  ON jobs FOR SELECT
  TO anon
  USING (true);

-- Create policies for parts
CREATE POLICY "Allow all operations on parts"
  ON parts FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public read on parts"
  ON parts FOR SELECT
  TO anon
  USING (true);

-- Create policies for time_entries
CREATE POLICY "Allow all operations on time_entries"
  ON time_entries FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public read on time_entries"
  ON time_entries FOR SELECT
  TO anon
  USING (true);

-- Create policies for business_details
CREATE POLICY "Allow all operations on business_details"
  ON business_details FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public read on business_details"
  ON business_details FOR SELECT
  TO anon
  USING (true);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_jobs_client_id ON jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_time ON jobs(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_parts_job_id ON parts(job_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_job_id ON time_entries(job_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_is_running ON time_entries(is_running);