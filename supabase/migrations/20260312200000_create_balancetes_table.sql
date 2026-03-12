-- Create balancetes table
CREATE TABLE omnia_balancetes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominium_id UUID NOT NULL REFERENCES omnia_condominiums(id) ON DELETE CASCADE,
  received_at DATE NOT NULL DEFAULT CURRENT_DATE,
  competencia VARCHAR(7) NOT NULL,
  volumes INTEGER NOT NULL DEFAULT 1,
  observations TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'recebido',
  sent_at TIMESTAMPTZ,
  created_by UUID REFERENCES omnia_users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_balancetes_condominium_id ON omnia_balancetes(condominium_id);
CREATE INDEX idx_balancetes_competencia ON omnia_balancetes(competencia);

-- RLS
ALTER TABLE omnia_balancetes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read balancetes"
  ON omnia_balancetes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert balancetes"
  ON omnia_balancetes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update balancetes"
  ON omnia_balancetes FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete balancetes"
  ON omnia_balancetes FOR DELETE
  TO authenticated
  USING (true);

-- Updated_at trigger (reusing existing function)
CREATE TRIGGER update_omnia_balancetes_updated_at
  BEFORE UPDATE ON omnia_balancetes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE omnia_balancetes IS 'Cadastro de livros de prestação de contas (balancetes) dos condomínios';
