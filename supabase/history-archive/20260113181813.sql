-- Aplicada em produção via dashboard, sem arquivo local correspondente.
-- Versão original em supabase_migrations.schema_migrations: 20260113181813
-- Arquivada antes do repair --status reverted que reconciliou o histórico.

-- Tabela principal de admissões
CREATE TABLE omnia_admissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id serial UNIQUE,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'NORMAL' 
    CHECK (priority IN ('URGENTE', 'ALTA', 'NORMAL', 'BAIXA')),
  due_date date,
  ticket_octa text,
  status_id uuid NOT NULL REFERENCES omnia_admissao_statuses(id),
  assigned_to uuid REFERENCES omnia_users(id),
  created_by uuid REFERENCES omnia_users(id),
  tags text[] DEFAULT '{}',
  comment_count integer DEFAULT 0,
  attachment_count integer DEFAULT 0,
  is_private boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX idx_admissoes_status ON omnia_admissoes(status_id);
CREATE INDEX idx_admissoes_assigned ON omnia_admissoes(assigned_to);
CREATE INDEX idx_admissoes_due_date ON omnia_admissoes(due_date);

-- Habilitar RLS
ALTER TABLE omnia_admissoes ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuários autenticados podem ler admissões"
  ON omnia_admissoes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem criar admissões"
  ON omnia_admissoes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar admissões"
  ON omnia_admissoes FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem deletar admissões"
  ON omnia_admissoes FOR DELETE
  TO authenticated
  USING (true);
