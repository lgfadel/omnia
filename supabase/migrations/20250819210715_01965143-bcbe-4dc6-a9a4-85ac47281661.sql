-- Create ticket statuses table
CREATE TABLE public.omnia_ticket_statuses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  order_position INTEGER NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on ticket statuses
ALTER TABLE public.omnia_ticket_statuses ENABLE ROW LEVEL SECURITY;

-- Create policies for ticket statuses (same as omnia_statuses)
CREATE POLICY "Anyone can view ticket statuses" 
ON public.omnia_ticket_statuses 
FOR SELECT 
USING (auth.role() = 'authenticated'::text);

CREATE POLICY "Admins can manage ticket statuses" 
ON public.omnia_ticket_statuses 
FOR ALL 
USING (EXISTS ( 
  SELECT 1 FROM omnia_users 
  WHERE omnia_users.auth_user_id = auth.uid() 
  AND 'ADMIN'::text = ANY (omnia_users.roles)
));

-- Create priority enum
CREATE TYPE public.ticket_priority AS ENUM ('ALTA', 'NORMAL', 'BAIXA');

-- Create tickets table
CREATE TABLE public.omnia_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  priority public.ticket_priority NOT NULL DEFAULT 'NORMAL',
  due_date DATE,
  ticket TEXT,
  status_id UUID NOT NULL,
  assigned_to UUID,
  created_by UUID,
  tags TEXT[] DEFAULT '{}'::text[],
  comment_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on tickets
ALTER TABLE public.omnia_tickets ENABLE ROW LEVEL SECURITY;

-- Create policies for tickets (same as omnia_atas)
CREATE POLICY "Anyone can view tickets" 
ON public.omnia_tickets 
FOR SELECT 
USING (auth.role() = 'authenticated'::text);

CREATE POLICY "Authenticated users can create tickets" 
ON public.omnia_tickets 
FOR INSERT 
WITH CHECK (EXISTS ( 
  SELECT 1 FROM omnia_users 
  WHERE omnia_users.auth_user_id = auth.uid() 
  AND omnia_users.roles && ARRAY['ADMIN'::text, 'SECRETARIO'::text, 'USUARIO'::text]
));

CREATE POLICY "Authenticated users can update tickets" 
ON public.omnia_tickets 
FOR UPDATE 
USING (EXISTS ( 
  SELECT 1 FROM omnia_users 
  WHERE omnia_users.auth_user_id = auth.uid() 
  AND omnia_users.roles && ARRAY['ADMIN'::text, 'SECRETARIO'::text, 'USUARIO'::text]
));

CREATE POLICY "Admins can delete tickets" 
ON public.omnia_tickets 
FOR DELETE 
USING (EXISTS ( 
  SELECT 1 FROM omnia_users 
  WHERE omnia_users.auth_user_id = auth.uid() 
  AND 'ADMIN'::text = ANY (omnia_users.roles)
));

-- Add ticket_id column to attachments
ALTER TABLE public.omnia_attachments 
ADD COLUMN ticket_id UUID;

-- Add ticket_id column to comments
ALTER TABLE public.omnia_comments 
ADD COLUMN ticket_id UUID;

-- Create trigger for ticket updated_at
CREATE TRIGGER update_tickets_updated_at
BEFORE UPDATE ON public.omnia_tickets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for ticket status updated_at
CREATE TRIGGER update_ticket_statuses_updated_at
BEFORE UPDATE ON public.omnia_ticket_statuses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for ticket comment count
CREATE TRIGGER update_ticket_comment_count
AFTER INSERT OR DELETE ON public.omnia_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_ata_comment_count();

-- Insert default ticket statuses
INSERT INTO public.omnia_ticket_statuses (name, color, order_position, is_default) VALUES
('Aberto', '#ef4444', 1, true),
('Em Andamento', '#f59e0b', 2, false),
('Aguardando', '#6b7280', 3, false),
('Resolvido', '#10b981', 4, false),
('Fechado', '#374151', 5, false);