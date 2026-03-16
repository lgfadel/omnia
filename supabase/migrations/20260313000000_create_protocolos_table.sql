-- Create protocolos table for grouping sent balancetes
CREATE TABLE omnia_protocolos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero SERIAL UNIQUE NOT NULL,
  data_envio DATE NOT NULL DEFAULT CURRENT_DATE,
  quantidade_balancetes INTEGER NOT NULL DEFAULT 0,
  cancelado BOOLEAN DEFAULT FALSE,
  cancelado_em TIMESTAMPTZ,
  cancelado_por UUID REFERENCES omnia_users(id),
  motivo_cancelamento TEXT,
  created_by UUID REFERENCES omnia_users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add protocolo_id column to balancetes
ALTER TABLE omnia_balancetes 
  ADD COLUMN protocolo_id UUID REFERENCES omnia_protocolos(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX idx_protocolos_numero ON omnia_protocolos(numero);
CREATE INDEX idx_protocolos_data_envio ON omnia_protocolos(data_envio);
CREATE INDEX idx_protocolos_cancelado ON omnia_protocolos(cancelado);
CREATE INDEX idx_balancetes_protocolo_id ON omnia_balancetes(protocolo_id);

-- RLS
ALTER TABLE omnia_protocolos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read protocolos"
  ON omnia_protocolos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert protocolos"
  ON omnia_protocolos FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update protocolos"
  ON omnia_protocolos FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Updated_at trigger
CREATE TRIGGER update_omnia_protocolos_updated_at
  BEFORE UPDATE ON omnia_protocolos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE omnia_protocolos IS 'Protocolos de envio de balancetes - agrupa balancetes enviados juntos';
COMMENT ON COLUMN omnia_protocolos.numero IS 'Número sequencial do protocolo';
COMMENT ON COLUMN omnia_protocolos.cancelado IS 'Indica se o protocolo foi cancelado';
COMMENT ON COLUMN omnia_protocolos.motivo_cancelamento IS 'Motivo do cancelamento (opcional)';
