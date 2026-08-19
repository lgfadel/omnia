-- Aplicada em produção via dashboard, sem arquivo local correspondente.
-- Versão original em supabase_migrations.schema_migrations: 20260113181828
-- Arquivada antes do repair --status reverted que reconciliou o histórico.

-- Tabela de anexos de admissão
CREATE TABLE omnia_admissao_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admissao_id uuid NOT NULL REFERENCES omnia_admissoes(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  size_kb integer,
  mime_type text,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_admissao_attachments_admissao ON omnia_admissao_attachments(admissao_id);

-- RLS
ALTER TABLE omnia_admissao_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ler anexos de admissão"
  ON omnia_admissao_attachments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuários autenticados podem criar anexos de admissão"
  ON omnia_admissao_attachments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem deletar anexos de admissão"
  ON omnia_admissao_attachments FOR DELETE TO authenticated USING (true);
