
-- Create the job-photos storage bucket (public so URLs work without tokens)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('job-photos', 'job-photos', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own folder
CREATE POLICY "auth_upload_job_photos" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'job-photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to read any photo (owner + employees)
CREATE POLICY "auth_read_job_photos" ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'job-photos');

-- Allow authenticated users to delete their own photos
CREATE POLICY "auth_delete_job_photos" ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'job-photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
