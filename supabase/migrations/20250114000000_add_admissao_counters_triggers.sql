-- Migration: Add triggers to automatically update comment_count and attachment_count in omnia_admissoes

-- Function to update comment count
CREATE OR REPLACE FUNCTION update_admissao_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE omnia_admissoes
    SET comment_count = COALESCE(comment_count, 0) + 1
    WHERE id = NEW.admissao_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE omnia_admissoes
    SET comment_count = GREATEST(COALESCE(comment_count, 1) - 1, 0)
    WHERE id = OLD.admissao_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update attachment count
CREATE OR REPLACE FUNCTION update_admissao_attachment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE omnia_admissoes
    SET attachment_count = COALESCE(attachment_count, 0) + 1
    WHERE id = NEW.admissao_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE omnia_admissoes
    SET attachment_count = GREATEST(COALESCE(attachment_count, 1) - 1, 0)
    WHERE id = OLD.admissao_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_update_admissao_comment_count ON omnia_admissao_comments;
DROP TRIGGER IF EXISTS trigger_update_admissao_attachment_count ON omnia_admissao_attachments;

-- Create trigger for comments
CREATE TRIGGER trigger_update_admissao_comment_count
AFTER INSERT OR DELETE ON omnia_admissao_comments
FOR EACH ROW
EXECUTE FUNCTION update_admissao_comment_count();

-- Create trigger for attachments
CREATE TRIGGER trigger_update_admissao_attachment_count
AFTER INSERT OR DELETE ON omnia_admissao_attachments
FOR EACH ROW
EXECUTE FUNCTION update_admissao_attachment_count();

-- Initialize counters for existing records
UPDATE omnia_admissoes a
SET comment_count = (
  SELECT COUNT(*)
  FROM omnia_admissao_comments c
  WHERE c.admissao_id = a.id
);

UPDATE omnia_admissoes a
SET attachment_count = (
  SELECT COUNT(*)
  FROM omnia_admissao_attachments att
  WHERE att.admissao_id = a.id
);
