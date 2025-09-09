-- Script SQL para criação das tabelas de comentários e anexos do CRM
-- Execute este script manualmente no Supabase

-- Tabela de comentários do CRM
CREATE TABLE IF NOT EXISTS omnia_crm_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES omnia_crm_leads(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES omnia_users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de anexos dos comentários do CRM
CREATE TABLE IF NOT EXISTS omnia_crm_attachments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id UUID REFERENCES omnia_crm_comments(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES omnia_crm_leads(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  mime_type TEXT,
  size_kb INTEGER,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraint para garantir que o anexo pertence a um comentário OU diretamente ao lead
  CONSTRAINT attachment_belongs_to_comment_or_lead CHECK (
    (comment_id IS NOT NULL AND lead_id IS NULL) OR 
    (comment_id IS NULL AND lead_id IS NOT NULL)
  )
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_crm_comments_lead_id ON omnia_crm_comments(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_comments_author_id ON omnia_crm_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_crm_comments_created_at ON omnia_crm_comments(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_attachments_comment_id ON omnia_crm_attachments(comment_id);
CREATE INDEX IF NOT EXISTS idx_crm_attachments_lead_id ON omnia_crm_attachments(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_attachments_uploaded_by ON omnia_crm_attachments(uploaded_by);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_crm_comments_updated_at 
    BEFORE UPDATE ON omnia_crm_comments 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) Policies

-- Habilitar RLS nas tabelas
ALTER TABLE omnia_crm_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE omnia_crm_attachments ENABLE ROW LEVEL SECURITY;

-- Políticas para omnia_crm_comments

-- Usuários autenticados podem ver todos os comentários
CREATE POLICY "Users can view all CRM comments" ON omnia_crm_comments
  FOR SELECT USING (auth.role() = 'authenticated');

-- Usuários autenticados podem inserir comentários
CREATE POLICY "Users can insert CRM comments" ON omnia_crm_comments
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Usuários podem atualizar apenas seus próprios comentários
CREATE POLICY "Users can update own CRM comments" ON omnia_crm_comments
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM omnia_users 
    WHERE auth_user_id = auth.uid() 
    AND id = omnia_crm_comments.author_id
  ));

-- Usuários podem deletar apenas seus próprios comentários
CREATE POLICY "Users can delete own CRM comments" ON omnia_crm_comments
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM omnia_users 
    WHERE auth_user_id = auth.uid() 
    AND id = omnia_crm_comments.author_id
  ));

-- Políticas para omnia_crm_attachments

-- Usuários autenticados podem ver todos os anexos
CREATE POLICY "Users can view all CRM attachments" ON omnia_crm_attachments
  FOR SELECT USING (auth.role() = 'authenticated');

-- Usuários autenticados podem inserir anexos
CREATE POLICY "Users can insert CRM attachments" ON omnia_crm_attachments
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = uploaded_by);

-- Usuários podem deletar apenas seus próprios anexos
CREATE POLICY "Users can delete own CRM attachments" ON omnia_crm_attachments
  FOR DELETE USING (auth.uid() = uploaded_by);

-- View para contar comentários por lead (para atualizar o comment_count)
CREATE OR REPLACE VIEW omnia_crm_lead_comment_counts AS
SELECT 
  lead_id,
  COUNT(*) as comment_count
FROM omnia_crm_comments
GROUP BY lead_id;

-- Função para atualizar o comment_count na tabela omnia_crm_leads
CREATE OR REPLACE FUNCTION update_crm_lead_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualiza o comment_count para o lead afetado
  IF TG_OP = 'DELETE' THEN
    UPDATE omnia_crm_leads 
    SET comment_count = COALESCE((
      SELECT COUNT(*) 
      FROM omnia_crm_comments 
      WHERE lead_id = OLD.lead_id
    ), 0)
    WHERE id = OLD.lead_id;
    RETURN OLD;
  ELSE
    UPDATE omnia_crm_leads 
    SET comment_count = COALESCE((
      SELECT COUNT(*) 
      FROM omnia_crm_comments 
      WHERE lead_id = NEW.lead_id
    ), 0)
    WHERE id = NEW.lead_id;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Triggers para manter o comment_count atualizado
CREATE TRIGGER trigger_update_crm_lead_comment_count_insert
  AFTER INSERT ON omnia_crm_comments
  FOR EACH ROW EXECUTE FUNCTION update_crm_lead_comment_count();

CREATE TRIGGER trigger_update_crm_lead_comment_count_delete
  AFTER DELETE ON omnia_crm_comments
  FOR EACH ROW EXECUTE FUNCTION update_crm_lead_comment_count();

-- Adicionar coluna comment_count na tabela omnia_crm_leads se não existir
ALTER TABLE omnia_crm_leads 
ADD COLUMN IF NOT EXISTS comment_count INTEGER DEFAULT 0;

-- Atualizar comment_count para leads existentes
UPDATE omnia_crm_leads 
SET comment_count = COALESCE((
  SELECT COUNT(*) 
  FROM omnia_crm_comments 
  WHERE lead_id = omnia_crm_leads.id
), 0);

-- Comentários sobre as tabelas
COMMENT ON TABLE omnia_crm_comments IS 'Comentários dos leads do CRM';
COMMENT ON TABLE omnia_crm_attachments IS 'Anexos dos comentários e leads do CRM';

COMMENT ON COLUMN omnia_crm_comments.lead_id IS 'ID do lead ao qual o comentário pertence';
COMMENT ON COLUMN omnia_crm_comments.author_id IS 'ID do usuário que criou o comentário';
COMMENT ON COLUMN omnia_crm_comments.body IS 'Conteúdo do comentário';

COMMENT ON COLUMN omnia_crm_attachments.comment_id IS 'ID do comentário (opcional, para anexos de comentários)';
COMMENT ON COLUMN omnia_crm_attachments.lead_id IS 'ID do lead (opcional, para anexos diretos do lead)';
COMMENT ON COLUMN omnia_crm_attachments.name IS 'Nome original do arquivo';
COMMENT ON COLUMN omnia_crm_attachments.url IS 'URL do arquivo no Supabase Storage';
COMMENT ON COLUMN omnia_crm_attachments.size_kb IS 'Tamanho do arquivo em KB';
COMMENT ON COLUMN omnia_crm_attachments.mime_type IS 'Tipo MIME do arquivo';
COMMENT ON COLUMN omnia_crm_attachments.uploaded_by IS 'ID do usuário que fez o upload';

-- Grants para garantir que o usuário autenticado tenha acesso
GRANT ALL ON omnia_crm_comments TO authenticated;
GRANT ALL ON omnia_crm_attachments TO authenticated;
GRANT SELECT ON omnia_crm_lead_comment_counts TO authenticated;

PRINT 'Tabelas de comentários e anexos do CRM criadas com sucesso!';