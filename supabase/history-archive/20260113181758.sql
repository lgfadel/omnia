-- Aplicada em produção via dashboard, sem arquivo local correspondente.
-- Versão original em supabase_migrations.schema_migrations: 20260113181758
-- Arquivada antes do repair --status reverted que reconciliou o histórico.

-- Tabela de status de admissão
CREATE TABLE omnia_admissao_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL,
  order_position integer NOT NULL,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE omnia_admissao_statuses ENABLE ROW LEVEL SECURITY;

-- Política de leitura para usuários autenticados
CREATE POLICY "Usuários autenticados podem ler status de admissão"
  ON omnia_admissao_statuses FOR SELECT
  TO authenticated
  USING (true);

-- Política de escrita para usuários autenticados
CREATE POLICY "Usuários autenticados podem gerenciar status de admissão"
  ON omnia_admissao_statuses FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Inserir status padrão
INSERT INTO omnia_admissao_statuses (name, color, order_position, is_default) VALUES
  ('Imprimir', '#3b82f6', 1, true),
  ('Assinatura Funcionário', '#f59e0b', 2, false),
  ('Enviar malote', '#8b5cf6', 3, false),
  ('Aguardando retorno', '#6b7280', 4, false),
  ('Escanear', '#06b6d4', 5, false),
  ('Enviar Analista', '#ec4899', 6, false),
  ('Arquivar', '#f97316', 7, false),
  ('Concluído', '#10b981', 8, false),
  ('On-hold', '#ef4444', 9, false);
