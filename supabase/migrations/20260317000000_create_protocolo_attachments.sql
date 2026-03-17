-- Create table for protocolo attachments (signed protocol documents)
CREATE TABLE IF NOT EXISTS omnia_protocolo_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo_id UUID NOT NULL REFERENCES omnia_protocolos(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  size_kb INTEGER,
  mime_type TEXT,
  uploaded_by UUID REFERENCES omnia_users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_omnia_protocolo_attachments_protocolo 
  ON omnia_protocolo_attachments(protocolo_id);

-- Enable RLS
ALTER TABLE omnia_protocolo_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view protocolo attachments"
  ON omnia_protocolo_attachments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can upload protocolo attachments"
  ON omnia_protocolo_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can delete their own protocolo attachments or admins can delete any"
  ON omnia_protocolo_attachments
  FOR DELETE
  TO authenticated
  USING (
    uploaded_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM omnia_users
      WHERE id = auth.uid()
      AND 'ADMIN' = ANY(roles)
    )
  );

-- Comments
COMMENT ON TABLE omnia_protocolo_attachments IS 'Anexos de protocolos de envio de balancetes (cópia do protocolo assinado)';
COMMENT ON COLUMN omnia_protocolo_attachments.protocolo_id IS 'ID do protocolo ao qual o anexo pertence';
COMMENT ON COLUMN omnia_protocolo_attachments.name IS 'Nome do arquivo anexado';
COMMENT ON COLUMN omnia_protocolo_attachments.url IS 'URL pública do arquivo no storage';
