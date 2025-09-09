-- Script SQL para implementar sistema de comentários e anexos no CRM de leads
-- Baseado no padrão das atas e tarefas
-- Data: $(date +%Y-%m-%d)

-- =====================================================
-- 1. TABELA DE COMENTÁRIOS DO CRM
-- =====================================================

CREATE TABLE IF NOT EXISTS public.omnia_crm_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID NOT NULL REFERENCES public.omnia_crm_leads(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.omnia_users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_omnia_crm_comments_lead_id ON public.omnia_crm_comments(lead_id);
CREATE INDEX IF NOT EXISTS idx_omnia_crm_comments_author_id ON public.omnia_crm_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_omnia_crm_comments_created_at ON public.omnia_crm_comments(created_at);

-- =====================================================
-- 2. TABELA DE ANEXOS DO CRM
-- =====================================================

CREATE TABLE IF NOT EXISTS public.omnia_crm_attachments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID REFERENCES public.omnia_crm_leads(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES public.omnia_crm_comments(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    mime_type TEXT,
    size_kb INTEGER,
    uploaded_by UUID REFERENCES public.omnia_users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Constraint: anexo deve estar associado a um lead OU a um comentário
    CONSTRAINT chk_attachment_association CHECK (
        (lead_id IS NOT NULL AND comment_id IS NULL) OR 
        (lead_id IS NULL AND comment_id IS NOT NULL)
    )
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_omnia_crm_attachments_lead_id ON public.omnia_crm_attachments(lead_id);
CREATE INDEX IF NOT EXISTS idx_omnia_crm_attachments_comment_id ON public.omnia_crm_attachments(comment_id);
CREATE INDEX IF NOT EXISTS idx_omnia_crm_attachments_uploaded_by ON public.omnia_crm_attachments(uploaded_by);

-- =====================================================
-- 3. ADICIONAR COLUNA COMMENT_COUNT NA TABELA DE LEADS
-- =====================================================

-- Verificar se a coluna já existe antes de adicionar
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'omnia_crm_leads' 
                   AND column_name = 'comment_count') THEN
        ALTER TABLE public.omnia_crm_leads 
        ADD COLUMN comment_count INTEGER DEFAULT 0 NOT NULL;
    END IF;
END $$;

-- =====================================================
-- 4. FUNÇÃO PARA ATUALIZAR CONTADOR DE COMENTÁRIOS
-- =====================================================

CREATE OR REPLACE FUNCTION update_crm_lead_comment_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Incrementar contador quando comentário é criado
        UPDATE public.omnia_crm_leads 
        SET comment_count = comment_count + 1,
            updated_at = timezone('utc'::text, now())
        WHERE id = NEW.lead_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Decrementar contador quando comentário é deletado
        UPDATE public.omnia_crm_leads 
        SET comment_count = GREATEST(comment_count - 1, 0),
            updated_at = timezone('utc'::text, now())
        WHERE id = OLD.lead_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. TRIGGERS PARA CONTADOR DE COMENTÁRIOS
-- =====================================================

-- Trigger para INSERT
DROP TRIGGER IF EXISTS trigger_crm_comment_count_insert ON public.omnia_crm_comments;
CREATE TRIGGER trigger_crm_comment_count_insert
    AFTER INSERT ON public.omnia_crm_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_crm_lead_comment_count();

-- Trigger para DELETE
DROP TRIGGER IF EXISTS trigger_crm_comment_count_delete ON public.omnia_crm_comments;
CREATE TRIGGER trigger_crm_comment_count_delete
    AFTER DELETE ON public.omnia_crm_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_crm_lead_comment_count();

-- =====================================================
-- 6. FUNÇÃO PARA ATUALIZAR UPDATED_AT
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. TRIGGERS PARA UPDATED_AT
-- =====================================================

-- Trigger para comentários
DROP TRIGGER IF EXISTS trigger_crm_comments_updated_at ON public.omnia_crm_comments;
CREATE TRIGGER trigger_crm_comments_updated_at
    BEFORE UPDATE ON public.omnia_crm_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 8. POLÍTICAS RLS (ROW LEVEL SECURITY)
-- =====================================================

-- Habilitar RLS nas tabelas
ALTER TABLE public.omnia_crm_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.omnia_crm_attachments ENABLE ROW LEVEL SECURITY;

-- Políticas para comentários
DROP POLICY IF EXISTS "Users can view CRM comments" ON public.omnia_crm_comments;
CREATE POLICY "Users can view CRM comments" ON public.omnia_crm_comments
    FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can create CRM comments" ON public.omnia_crm_comments;
CREATE POLICY "Users can create CRM comments" ON public.omnia_crm_comments
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update own CRM comments" ON public.omnia_crm_comments;
CREATE POLICY "Users can update own CRM comments" ON public.omnia_crm_comments
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.omnia_users 
            WHERE auth_user_id = auth.uid() 
            AND id = omnia_crm_comments.author_id
        )
    );

DROP POLICY IF EXISTS "Users can delete own CRM comments" ON public.omnia_crm_comments;
CREATE POLICY "Users can delete own CRM comments" ON public.omnia_crm_comments
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.omnia_users 
            WHERE auth_user_id = auth.uid() 
            AND id = omnia_crm_comments.author_id
        )
    );

-- Políticas para anexos
DROP POLICY IF EXISTS "Users can view CRM attachments" ON public.omnia_crm_attachments;
CREATE POLICY "Users can view CRM attachments" ON public.omnia_crm_attachments
    FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can create CRM attachments" ON public.omnia_crm_attachments;
CREATE POLICY "Users can create CRM attachments" ON public.omnia_crm_attachments
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can delete own CRM attachments" ON public.omnia_crm_attachments;
CREATE POLICY "Users can delete own CRM attachments" ON public.omnia_crm_attachments
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.omnia_users 
            WHERE auth_user_id = auth.uid() 
            AND id = omnia_crm_attachments.uploaded_by
        )
    );

-- =====================================================
-- 9. ATUALIZAR CONTADOR PARA LEADS EXISTENTES
-- =====================================================

-- Recalcular comment_count para todos os leads existentes
UPDATE public.omnia_crm_leads 
SET comment_count = (
    SELECT COUNT(*) 
    FROM public.omnia_crm_comments 
    WHERE lead_id = omnia_crm_leads.id
)
WHERE comment_count != (
    SELECT COUNT(*) 
    FROM public.omnia_crm_comments 
    WHERE lead_id = omnia_crm_leads.id
);

-- =====================================================
-- 10. COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================================

-- Adicionar comentários nas tabelas
COMMENT ON TABLE public.omnia_crm_comments IS 'Comentários dos leads do CRM';
COMMENT ON TABLE public.omnia_crm_attachments IS 'Anexos dos leads e comentários do CRM';

COMMENT ON COLUMN public.omnia_crm_comments.lead_id IS 'ID do lead associado';
COMMENT ON COLUMN public.omnia_crm_comments.author_id IS 'ID do usuário autor do comentário';
COMMENT ON COLUMN public.omnia_crm_comments.body IS 'Conteúdo do comentário';

COMMENT ON COLUMN public.omnia_crm_attachments.lead_id IS 'ID do lead (para anexos diretos)';
COMMENT ON COLUMN public.omnia_crm_attachments.comment_id IS 'ID do comentário (para anexos de comentários)';
COMMENT ON COLUMN public.omnia_crm_attachments.name IS 'Nome original do arquivo';
COMMENT ON COLUMN public.omnia_crm_attachments.url IS 'URL do arquivo no Supabase Storage';
COMMENT ON COLUMN public.omnia_crm_attachments.mime_type IS 'Tipo MIME do arquivo';
COMMENT ON COLUMN public.omnia_crm_attachments.size_kb IS 'Tamanho do arquivo em KB';

-- =====================================================
-- SCRIPT CONCLUÍDO
-- =====================================================

-- Para aplicar este script:
-- 1. Conecte-se ao Supabase
-- 2. Execute este script no SQL Editor
-- 3. Verifique se todas as tabelas foram criadas
-- 4. Teste as políticas RLS
-- 5. Implemente os componentes frontend correspondentes

SELECT 'Script de comentários e anexos do CRM aplicado com sucesso!' as status;