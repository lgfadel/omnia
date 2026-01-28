-- Create table for demissões (similar to admissões)
CREATE TABLE IF NOT EXISTS omnia_demissoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id INTEGER NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'media',
  due_date DATE,
  ticket_octa TEXT,
  status_id UUID NOT NULL REFERENCES omnia_demissao_statuses(id),
  assigned_to UUID REFERENCES omnia_users(id),
  created_by UUID REFERENCES omnia_users(id),
  tags UUID[],
  comment_count INTEGER DEFAULT 0,
  attachment_count INTEGER DEFAULT 0,
  is_private BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create sequence for ticket_id
CREATE SEQUENCE IF NOT EXISTS omnia_demissoes_ticket_id_seq;
ALTER TABLE omnia_demissoes ALTER COLUMN ticket_id SET DEFAULT nextval('omnia_demissoes_ticket_id_seq');

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_omnia_demissoes_status ON omnia_demissoes(status_id);
CREATE INDEX IF NOT EXISTS idx_omnia_demissoes_assigned_to ON omnia_demissoes(assigned_to);
CREATE INDEX IF NOT EXISTS idx_omnia_demissoes_created_by ON omnia_demissoes(created_by);
CREATE INDEX IF NOT EXISTS idx_omnia_demissoes_due_date ON omnia_demissoes(due_date);
CREATE INDEX IF NOT EXISTS idx_omnia_demissoes_created_at ON omnia_demissoes(created_at DESC);

-- Enable RLS
ALTER TABLE omnia_demissoes ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow authenticated users to read demissoes"
  ON omnia_demissoes
  FOR SELECT
  TO authenticated
  USING (
    NOT is_private OR 
    created_by = auth.uid() OR 
    assigned_to = auth.uid()
  );

CREATE POLICY "Allow authenticated users to insert demissoes"
  ON omnia_demissoes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update demissoes"
  ON omnia_demissoes
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete demissoes"
  ON omnia_demissoes
  FOR DELETE
  TO authenticated
  USING (true);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_omnia_demissoes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_omnia_demissoes_updated_at
  BEFORE UPDATE ON omnia_demissoes
  FOR EACH ROW
  EXECUTE FUNCTION update_omnia_demissoes_updated_at();

-- Create tables for comments and attachments
CREATE TABLE IF NOT EXISTS omnia_demissao_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demissao_id UUID NOT NULL REFERENCES omnia_demissoes(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES omnia_users(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_omnia_demissao_comments_demissao ON omnia_demissao_comments(demissao_id);
CREATE INDEX IF NOT EXISTS idx_omnia_demissao_comments_created_at ON omnia_demissao_comments(created_at DESC);

ALTER TABLE omnia_demissao_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read demissao comments"
  ON omnia_demissao_comments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert demissao comments"
  ON omnia_demissao_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS omnia_demissao_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demissao_id UUID NOT NULL REFERENCES omnia_demissoes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  mime_type TEXT,
  size_kb INTEGER,
  uploaded_by UUID REFERENCES omnia_users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_omnia_demissao_attachments_demissao ON omnia_demissao_attachments(demissao_id);

ALTER TABLE omnia_demissao_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read demissao attachments"
  ON omnia_demissao_attachments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert demissao attachments"
  ON omnia_demissao_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create triggers for comment and attachment counters
CREATE OR REPLACE FUNCTION update_demissao_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE omnia_demissoes 
    SET comment_count = COALESCE(comment_count, 0) + 1 
    WHERE id = NEW.demissao_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE omnia_demissoes 
    SET comment_count = GREATEST(COALESCE(comment_count, 0) - 1, 0) 
    WHERE id = OLD.demissao_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_demissao_comment_count
  AFTER INSERT OR DELETE ON omnia_demissao_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_demissao_comment_count();

CREATE OR REPLACE FUNCTION update_demissao_attachment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE omnia_demissoes 
    SET attachment_count = COALESCE(attachment_count, 0) + 1 
    WHERE id = NEW.demissao_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE omnia_demissoes 
    SET attachment_count = GREATEST(COALESCE(attachment_count, 0) - 1, 0) 
    WHERE id = OLD.demissao_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_demissao_attachment_count
  AFTER INSERT OR DELETE ON omnia_demissao_attachments
  FOR EACH ROW
  EXECUTE FUNCTION update_demissao_attachment_count();
