-- Aplicada em produção via dashboard, sem arquivo local correspondente.
-- Versão original em supabase_migrations.schema_migrations: 20260113181859
-- Arquivada antes do repair --status reverted que reconciliou o histórico.

-- Trigger para atualizar comment_count
CREATE OR REPLACE FUNCTION update_admissao_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE omnia_admissoes SET comment_count = comment_count + 1 WHERE id = NEW.admissao_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE omnia_admissoes SET comment_count = comment_count - 1 WHERE id = OLD.admissao_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_admissao_comment_count
AFTER INSERT OR DELETE ON omnia_admissao_comments
FOR EACH ROW EXECUTE FUNCTION update_admissao_comment_count();

-- Trigger para atualizar attachment_count
CREATE OR REPLACE FUNCTION update_admissao_attachment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE omnia_admissoes SET attachment_count = attachment_count + 1 WHERE id = NEW.admissao_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE omnia_admissoes SET attachment_count = attachment_count - 1 WHERE id = OLD.admissao_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_admissao_attachment_count
AFTER INSERT OR DELETE ON omnia_admissao_attachments
FOR EACH ROW EXECUTE FUNCTION update_admissao_attachment_count();

-- Trigger para updated_at (função customizada)
CREATE OR REPLACE FUNCTION set_admissoes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_admissoes_updated_at
BEFORE UPDATE ON omnia_admissoes
FOR EACH ROW EXECUTE FUNCTION set_admissoes_updated_at();
