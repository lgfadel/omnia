INSERT INTO storage.buckets (id, name, public)
VALUES ('balancete-attachments', 'balancete-attachments', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('balancete-import-pages', 'balancete-import-pages', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view balancete attachments files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'balancete-attachments');

CREATE POLICY "Authenticated users can upload balancete attachments files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'balancete-attachments'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can update their own balancete attachments files"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'balancete-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own balancete attachments files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'balancete-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Anyone can view balancete import page files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'balancete-import-pages');

CREATE POLICY "Authenticated users can upload balancete import page files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'balancete-import-pages'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can update their own balancete import page files"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'balancete-import-pages'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own balancete import page files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'balancete-import-pages'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
