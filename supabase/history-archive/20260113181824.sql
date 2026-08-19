-- Aplicada em produção via dashboard, sem arquivo local correspondente.
-- Versão original em supabase_migrations.schema_migrations: 20260113181824
-- Arquivada antes do repair --status reverted que reconciliou o histórico.

-- Tabela de comentários de admissão
CREATE TABLE omnia_admissao_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admissao_id uuid NOT NULL REFERENCES omnia_admissoes(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES omnia_users(id),
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_admissao_comments_admissao ON omnia_admissao_comments(admissao_id);

-- RLS
ALTER TABLE omnia_admissao_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ler comentários de admissão"
  ON omnia_admissao_comments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuários autenticados podem criar comentários de admissão"
  ON omnia_admissao_comments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem deletar comentários de admissão"
  ON omnia_admissao_comments FOR DELETE TO authenticated USING (true);
