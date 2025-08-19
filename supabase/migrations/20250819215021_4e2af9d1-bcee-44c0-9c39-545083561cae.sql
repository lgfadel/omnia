-- Criar tabela de comentários específica para tickets
CREATE TABLE public.omnia_ticket_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL,
  body TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  author_id UUID NOT NULL
);

-- Criar tabela de anexos específica para tickets
CREATE TABLE public.omnia_ticket_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  mime_type TEXT,
  size_kb INTEGER,
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS para as novas tabelas
ALTER TABLE public.omnia_ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.omnia_ticket_attachments ENABLE ROW LEVEL SECURITY;

-- Políticas para omnia_ticket_comments
CREATE POLICY "Anyone can view ticket comments" 
ON public.omnia_ticket_comments 
FOR SELECT 
USING (auth.role() = 'authenticated'::text);

CREATE POLICY "Authenticated users can create ticket comments" 
ON public.omnia_ticket_comments 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated'::text);

CREATE POLICY "Users can update their own ticket comments" 
ON public.omnia_ticket_comments 
FOR UPDATE 
USING ((created_by = auth.uid()) OR (EXISTS ( SELECT 1
  FROM omnia_users
  WHERE ((omnia_users.auth_user_id = auth.uid()) AND ('ADMIN'::text = ANY (omnia_users.roles))))));

CREATE POLICY "Users can delete their own ticket comments or admins can delete any" 
ON public.omnia_ticket_comments 
FOR DELETE 
USING ((created_by = auth.uid()) OR (EXISTS ( SELECT 1
  FROM omnia_users
  WHERE ((omnia_users.auth_user_id = auth.uid()) AND ('ADMIN'::text = ANY (omnia_users.roles))))));

-- Políticas para omnia_ticket_attachments
CREATE POLICY "Anyone can view ticket attachments" 
ON public.omnia_ticket_attachments 
FOR SELECT 
USING (auth.role() = 'authenticated'::text);

CREATE POLICY "Authenticated users can upload ticket attachments" 
ON public.omnia_ticket_attachments 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated'::text);

CREATE POLICY "Users can delete their own ticket attachments or admins can delete any" 
ON public.omnia_ticket_attachments 
FOR DELETE 
USING ((uploaded_by = auth.uid()) OR (EXISTS ( SELECT 1
  FROM omnia_users
  WHERE ((omnia_users.auth_user_id = auth.uid()) AND ('ADMIN'::text = ANY (omnia_users.roles))))));

-- Trigger para atualizar comment_count nos tickets
CREATE OR REPLACE FUNCTION public.update_ticket_comment_count_new()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.omnia_tickets 
    SET comment_count = comment_count + 1 
    WHERE id = NEW.ticket_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.omnia_tickets 
    SET comment_count = comment_count - 1 
    WHERE id = OLD.ticket_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger na nova tabela
CREATE TRIGGER update_ticket_comment_count_trigger
  AFTER INSERT OR DELETE ON public.omnia_ticket_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ticket_comment_count_new();

-- Migrar dados existentes de comentários de tickets (se existirem)
INSERT INTO public.omnia_ticket_comments (ticket_id, body, created_by, created_at, author_id)
SELECT ticket_id, body, created_by, created_at, author_id
FROM public.omnia_comments
WHERE ticket_id IS NOT NULL;

-- Migrar dados existentes de anexos de tickets (se existirem)
INSERT INTO public.omnia_ticket_attachments (ticket_id, name, url, mime_type, size_kb, uploaded_by, created_at)
SELECT ticket_id, name, url, mime_type, size_kb, uploaded_by, created_at
FROM public.omnia_attachments
WHERE ticket_id IS NOT NULL;

-- Remover colunas ticket_id das tabelas originais (agora só para atas)
ALTER TABLE public.omnia_comments DROP COLUMN IF EXISTS ticket_id;
ALTER TABLE public.omnia_attachments DROP COLUMN IF EXISTS ticket_id;