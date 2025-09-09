-- Criar enum para status de negociação do CRM
CREATE TYPE public.crm_negotiation_status AS ENUM (
  'novo',
  'qualificado', 
  'proposta_enviada',
  'em_negociacao',
  'on_hold',
  'ganho',
  'perdido'
);

-- Criar tabela principal de leads do CRM
CREATE TABLE public.omnia_crm_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente TEXT NOT NULL,
  numero_unidades INTEGER,
  numero_funcionarios_proprios INTEGER,
  numero_funcionarios_terceirizados INTEGER,
  administradora_atual TEXT,
  observacoes TEXT,
  status crm_negotiation_status NOT NULL DEFAULT 'novo',
  
  -- Endereço completo
  cep TEXT,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  estado TEXT,
  
  -- Dados do síndico
  sindico_nome TEXT,
  sindico_telefone TEXT,
  sindico_email TEXT,
  sindico_whatsapp TEXT,
  
  -- Valor da proposta
  valor_proposta DECIMAL(15,2),
  
  -- Controles
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  assigned_to UUID,
  comment_count INTEGER DEFAULT 0
);

-- Criar tabela de comentários do CRM
CREATE TABLE public.omnia_crm_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.omnia_crm_leads(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  created_by UUID,
  body TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de anexos do CRM
CREATE TABLE public.omnia_crm_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.omnia_crm_leads(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.omnia_crm_comments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  mime_type TEXT,
  size_kb INTEGER,
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.omnia_crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.omnia_crm_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.omnia_crm_attachments ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para omnia_crm_leads
CREATE POLICY "Admins can manage all leads" 
ON public.omnia_crm_leads 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM omnia_users 
  WHERE auth_user_id = auth.uid() 
  AND 'ADMIN' = ANY(roles)
));

CREATE POLICY "Users can view all leads" 
ON public.omnia_crm_leads 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Secretarios and users can create leads" 
ON public.omnia_crm_leads 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM omnia_users 
  WHERE auth_user_id = auth.uid() 
  AND roles && ARRAY['ADMIN', 'SECRETARIO', 'USUARIO']
));

CREATE POLICY "Secretarios and users can update leads" 
ON public.omnia_crm_leads 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM omnia_users 
  WHERE auth_user_id = auth.uid() 
  AND roles && ARRAY['ADMIN', 'SECRETARIO', 'USUARIO']
));

-- Políticas RLS para omnia_crm_comments
CREATE POLICY "Anyone can view crm comments" 
ON public.omnia_crm_comments 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create crm comments" 
ON public.omnia_crm_comments 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own crm comments" 
ON public.omnia_crm_comments 
FOR UPDATE 
USING (created_by = auth.uid() OR EXISTS (
  SELECT 1 FROM omnia_users 
  WHERE auth_user_id = auth.uid() 
  AND 'ADMIN' = ANY(roles)
));

CREATE POLICY "Users can delete their own crm comments or admins can delete any" 
ON public.omnia_crm_comments 
FOR DELETE 
USING (created_by = auth.uid() OR EXISTS (
  SELECT 1 FROM omnia_users 
  WHERE auth_user_id = auth.uid() 
  AND 'ADMIN' = ANY(roles)
));

-- Políticas RLS para omnia_crm_attachments
CREATE POLICY "Anyone can view crm attachments" 
ON public.omnia_crm_attachments 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can upload crm attachments" 
ON public.omnia_crm_attachments 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own crm attachments or admins can delete any" 
ON public.omnia_crm_attachments 
FOR DELETE 
USING (uploaded_by = auth.uid() OR EXISTS (
  SELECT 1 FROM omnia_users 
  WHERE auth_user_id = auth.uid() 
  AND 'ADMIN' = ANY(roles)
));

-- Função para atualizar comment_count
CREATE OR REPLACE FUNCTION public.update_crm_lead_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.omnia_crm_leads 
    SET comment_count = comment_count + 1 
    WHERE id = NEW.lead_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.omnia_crm_leads 
    SET comment_count = comment_count - 1 
    WHERE id = OLD.lead_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar comment_count
CREATE TRIGGER update_crm_lead_comment_count_trigger
  AFTER INSERT OR DELETE ON public.omnia_crm_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_crm_lead_comment_count();

-- Trigger para updated_at
CREATE TRIGGER update_crm_leads_updated_at
  BEFORE UPDATE ON public.omnia_crm_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();