-- Individual signed attachments per sent balancete
CREATE TABLE IF NOT EXISTS omnia_balancete_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  balancete_id UUID NOT NULL REFERENCES omnia_balancetes(id) ON DELETE CASCADE,
  protocolo_id UUID REFERENCES omnia_protocolos(id) ON DELETE SET NULL,
  source_page_number INTEGER,
  detected_protocol_number INTEGER,
  ocr_status TEXT NOT NULL DEFAULT 'manual' CHECK (
    ocr_status IN ('matched', 'not_found', 'protocol_not_found', 'multiple_matches', 'already_attached', 'error', 'manual')
  ),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  size_kb INTEGER,
  mime_type TEXT,
  uploaded_by UUID REFERENCES omnia_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_omnia_balancete_attachments_balancete
  ON omnia_balancete_attachments(balancete_id);

CREATE INDEX IF NOT EXISTS idx_omnia_balancete_attachments_protocolo
  ON omnia_balancete_attachments(protocolo_id);

ALTER TABLE omnia_balancete_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view balancete attachments"
  ON omnia_balancete_attachments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert balancete attachments"
  ON omnia_balancete_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update balancete attachments"
  ON omnia_balancete_attachments
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete their own balancete attachments or admins can delete any"
  ON omnia_balancete_attachments
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

COMMENT ON TABLE omnia_balancete_attachments IS 'Anexos individuais dos comprovantes assinados de balancetes enviados';
COMMENT ON COLUMN omnia_balancete_attachments.source_page_number IS 'Numero da pagina de origem dentro do PDF de importacao';
COMMENT ON COLUMN omnia_balancete_attachments.detected_protocol_number IS 'Numero do protocolo detectado via OCR';
COMMENT ON COLUMN omnia_balancete_attachments.ocr_status IS 'Status final do processamento OCR da pagina';

-- Import batches for scanned protocol PDFs
CREATE TABLE IF NOT EXISTS omnia_balancete_protocol_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_filename TEXT NOT NULL,
  total_pages INTEGER NOT NULL DEFAULT 0,
  matched_count INTEGER NOT NULL DEFAULT 0,
  pending_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES omnia_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS omnia_balancete_protocol_import_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES omnia_balancete_protocol_import_batches(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  detected_protocol_number INTEGER,
  confidence TEXT CHECK (confidence IN ('high', 'medium', 'low')),
  status TEXT NOT NULL CHECK (
    status IN ('matched', 'not_found', 'protocol_not_found', 'multiple_matches', 'already_attached', 'error', 'resolved')
  ),
  protocolo_id UUID REFERENCES omnia_protocolos(id) ON DELETE SET NULL,
  balancete_id UUID REFERENCES omnia_balancetes(id) ON DELETE SET NULL,
  candidate_balancete_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  page_file_name TEXT NOT NULL,
  page_file_path TEXT NOT NULL,
  page_file_url TEXT NOT NULL,
  error_message TEXT,
  resolved_by UUID REFERENCES omnia_users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_omnia_balancete_protocol_import_items_batch
  ON omnia_balancete_protocol_import_items(batch_id);

CREATE INDEX IF NOT EXISTS idx_omnia_balancete_protocol_import_items_status
  ON omnia_balancete_protocol_import_items(status);

ALTER TABLE omnia_balancete_protocol_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE omnia_balancete_protocol_import_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view balancete protocol import batches"
  ON omnia_balancete_protocol_import_batches
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert balancete protocol import batches"
  ON omnia_balancete_protocol_import_batches
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update balancete protocol import batches"
  ON omnia_balancete_protocol_import_batches
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view balancete protocol import items"
  ON omnia_balancete_protocol_import_items
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert balancete protocol import items"
  ON omnia_balancete_protocol_import_items
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update balancete protocol import items"
  ON omnia_balancete_protocol_import_items
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE omnia_balancete_protocol_import_batches IS 'Lotes de importacao de protocolos escaneados';
COMMENT ON TABLE omnia_balancete_protocol_import_items IS 'Resultado do processamento pagina a pagina dos lotes de protocolos escaneados';
