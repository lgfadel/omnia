-- Suporte à importação em lote de balancetes via CSV.
--
-- received_at passa a ser opcional: NULL significa "digital pronto, aguardando
-- o balancete físico" (só é possível para condomínios com balancete_digital = false).
ALTER TABLE omnia_balancetes
  ALTER COLUMN received_at DROP NOT NULL,
  ALTER COLUMN received_at DROP DEFAULT;

ALTER TABLE omnia_balancetes
  ADD COLUMN digital_prepared_at TIMESTAMPTZ;

COMMENT ON COLUMN omnia_balancetes.digital_prepared_at IS
  'Data/hora em que o balancete digital foi gerado na origem (ex: importação CSV). Preenchido tanto para condomínios digitais quanto físicos.';

-- Lote de importação de CSV (auditoria simples, sem tabela de itens: o CSV é
-- pequeno e a revisão/resolução acontece toda na mesma sessão de UI, antes de
-- qualquer gravação).
CREATE TABLE IF NOT EXISTS omnia_balancete_csv_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_filename TEXT NOT NULL,
  total_rows INTEGER NOT NULL DEFAULT 0,
  created_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  ignored_count INTEGER NOT NULL DEFAULT 0,
  not_matched_count INTEGER NOT NULL DEFAULT 0,
  details JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES omnia_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE omnia_balancetes
  ADD COLUMN csv_import_batch_id UUID REFERENCES omnia_balancete_csv_import_batches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_omnia_balancetes_csv_import_batch
  ON omnia_balancetes(csv_import_batch_id);

ALTER TABLE omnia_balancete_csv_import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view balancete csv import batches"
  ON omnia_balancete_csv_import_batches
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert balancete csv import batches"
  ON omnia_balancete_csv_import_batches
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

COMMENT ON TABLE omnia_balancete_csv_import_batches IS
  'Lotes de importação de balancetes via CSV (última competência disponível por condomínio)';
