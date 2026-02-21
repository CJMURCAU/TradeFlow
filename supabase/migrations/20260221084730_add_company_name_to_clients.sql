/*
  # Add company_name column to clients table

  1. Changes
    - `clients` table: add `company_name` (text) column to store the client's company name
    - The existing `name` column is repurposed as the contact person name

  2. Notes
    - Column is nullable so existing records are not broken
    - Default is empty string for consistency
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'company_name'
  ) THEN
    ALTER TABLE clients ADD COLUMN company_name text NOT NULL DEFAULT '';
  END IF;
END $$;
