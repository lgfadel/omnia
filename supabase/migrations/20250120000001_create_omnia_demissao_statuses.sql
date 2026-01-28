-- Create table for demissão statuses
CREATE TABLE IF NOT EXISTS omnia_demissao_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  order_position INTEGER NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for ordering
CREATE INDEX IF NOT EXISTS idx_omnia_demissao_statuses_order ON omnia_demissao_statuses(order_position);

-- Enable RLS
ALTER TABLE omnia_demissao_statuses ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow authenticated users to read demissao statuses"
  ON omnia_demissao_statuses
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert demissao statuses"
  ON omnia_demissao_statuses
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update demissao statuses"
  ON omnia_demissao_statuses
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete demissao statuses"
  ON omnia_demissao_statuses
  FOR DELETE
  TO authenticated
  USING (NOT is_default);

-- Insert default statuses
INSERT INTO omnia_demissao_statuses (name, color, order_position, is_default) VALUES
  ('Imprimir', '#3b82f6', 1, true),
  ('Enviar Malote', '#f59e0b', 2, false),
  ('Aguardando retorno', '#8b5cf6', 3, false),
  ('Assinatura funcionario', '#06b6d4', 4, false),
  ('Escanear', '#ec4899', 5, false),
  ('Enviar Analista', '#f97316', 6, false),
  ('Arquivar', '#10b981', 7, false),
  ('Concluido', '#84cc16', 8, false),
  ('On-hold', '#6b7280', 9, false);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_omnia_demissao_statuses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_omnia_demissao_statuses_updated_at
  BEFORE UPDATE ON omnia_demissao_statuses
  FOR EACH ROW
  EXECUTE FUNCTION update_omnia_demissao_statuses_updated_at();
