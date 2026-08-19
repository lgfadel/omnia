-- Aplicada em produção via dashboard, sem arquivo local correspondente.
-- Versão original em supabase_migrations.schema_migrations: 20260127234812
-- Arquivada antes do repair --status reverted que reconciliou o histórico.

-- Rename tables from demissao to rescisao
ALTER TABLE omnia_demissao_statuses RENAME TO omnia_rescisao_statuses;
ALTER TABLE omnia_demissoes RENAME TO omnia_rescisoes;
ALTER TABLE omnia_demissao_comments RENAME TO omnia_rescisao_comments;
ALTER TABLE omnia_demissao_attachments RENAME TO omnia_rescisao_attachments;

-- Rename columns
ALTER TABLE omnia_rescisao_comments RENAME COLUMN demissao_id TO rescisao_id;
ALTER TABLE omnia_rescisao_attachments RENAME COLUMN demissao_id TO rescisao_id;

-- Rename sequences
ALTER SEQUENCE omnia_demissoes_ticket_id_seq RENAME TO omnia_rescisoes_ticket_id_seq;

-- Drop old triggers
DROP TRIGGER IF EXISTS trigger_update_omnia_demissao_statuses_updated_at ON omnia_rescisao_statuses;
DROP TRIGGER IF EXISTS trigger_update_omnia_demissoes_updated_at ON omnia_rescisoes;
DROP TRIGGER IF EXISTS trigger_demissao_comment_count ON omnia_rescisao_comments;
DROP TRIGGER IF EXISTS trigger_demissao_attachment_count ON omnia_rescisao_attachments;

-- Create new functions
CREATE OR REPLACE FUNCTION update_omnia_rescisao_statuses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_omnia_rescisoes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_rescisao_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE omnia_rescisoes 
    SET comment_count = COALESCE(comment_count, 0) + 1 
    WHERE id = NEW.rescisao_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE omnia_rescisoes 
    SET comment_count = GREATEST(COALESCE(comment_count, 0) - 1, 0) 
    WHERE id = OLD.rescisao_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_rescisao_attachment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE omnia_rescisoes 
    SET attachment_count = COALESCE(attachment_count, 0) + 1 
    WHERE id = NEW.rescisao_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE omnia_rescisoes 
    SET attachment_count = GREATEST(COALESCE(attachment_count, 0) - 1, 0) 
    WHERE id = OLD.rescisao_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create new triggers
CREATE TRIGGER trigger_update_omnia_rescisao_statuses_updated_at
  BEFORE UPDATE ON omnia_rescisao_statuses
  FOR EACH ROW
  EXECUTE FUNCTION update_omnia_rescisao_statuses_updated_at();

CREATE TRIGGER trigger_update_omnia_rescisoes_updated_at
  BEFORE UPDATE ON omnia_rescisoes
  FOR EACH ROW
  EXECUTE FUNCTION update_omnia_rescisoes_updated_at();

CREATE TRIGGER trigger_rescisao_comment_count
  AFTER INSERT OR DELETE ON omnia_rescisao_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_rescisao_comment_count();

CREATE TRIGGER trigger_rescisao_attachment_count
  AFTER INSERT OR DELETE ON omnia_rescisao_attachments
  FOR EACH ROW
  EXECUTE FUNCTION update_rescisao_attachment_count();
