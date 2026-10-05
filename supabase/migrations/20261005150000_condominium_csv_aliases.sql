-- Memória de correspondência nome-do-CSV -> condomínio.
--
-- A importação de balancetes via CSV casa `nome_condominio` com o cadastro por
-- similaridade. Quando o usuário confirma ou corrige um nome, gravamos o par aqui
-- para que os próximos arquivos o resolvam sozinhos, sem nova revisão.
--
-- alias_normalized segue `normalizeCondominiumName` (apps/web-next/src/lib/condominiumNameMatch.ts):
-- NFD sem diacríticos, maiúsculas, espaços colapsados. UNIQUE: um nome de CSV aponta
-- para um único condomínio; a correção do usuário sobrescreve via upsert.
CREATE TABLE IF NOT EXISTS omnia_condominium_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominium_id UUID NOT NULL REFERENCES omnia_condominiums(id) ON DELETE CASCADE,
  alias_normalized TEXT NOT NULL,
  alias_original TEXT NOT NULL,
  created_by UUID REFERENCES omnia_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT omnia_condominium_aliases_alias_normalized_key UNIQUE (alias_normalized),
  CONSTRAINT omnia_condominium_aliases_alias_not_blank CHECK (length(btrim(alias_normalized)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_omnia_condominium_aliases_condominium
  ON omnia_condominium_aliases(condominium_id);

ALTER TABLE omnia_condominium_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view condominium aliases"
  ON omnia_condominium_aliases
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert condominium aliases"
  ON omnia_condominium_aliases
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update condominium aliases"
  ON omnia_condominium_aliases
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete condominium aliases"
  ON omnia_condominium_aliases
  FOR DELETE
  TO authenticated
  USING (true);

CREATE TRIGGER update_omnia_condominium_aliases_updated_at
  BEFORE UPDATE ON omnia_condominium_aliases
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE omnia_condominium_aliases IS
  'Nomes de condomínio vistos em arquivos de importação (ex: CSV de balancetes) já confirmados pelo usuário e o condomínio correspondente';

-- Os contadores do lote de importação são gravados com UPDATE depois das linhas,
-- mas a migration original só criou policies de SELECT e INSERT: o UPDATE afetava
-- 0 linhas sem erro. Mesmo regime das demais policies da tabela.
CREATE POLICY "Authenticated users can update balancete csv import batches"
  ON omnia_balancete_csv_import_batches
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
