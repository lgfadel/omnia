-- Create storage bucket for protocolo attachments
INSERT INTO storage.buckets (id, name, public) 
VALUES ('protocolos', 'protocolos', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for protocolos bucket
CREATE POLICY "Anyone can view protocolo attachments" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'protocolos');

CREATE POLICY "Authenticated users can upload protocolo attachments" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'protocolos' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can update their own protocolo attachments" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'protocolos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own protocolo attachments" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'protocolos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
