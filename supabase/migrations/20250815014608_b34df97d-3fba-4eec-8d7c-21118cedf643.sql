-- Create omnia_statuses table
CREATE TABLE public.omnia_statuses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  order_position INTEGER NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create omnia_users table (for user references)
CREATE TABLE public.omnia_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  role TEXT DEFAULT 'LEITOR' CHECK (role IN ('ADMIN', 'SECRETARIO', 'LEITOR')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create omnia_atas table
CREATE TABLE public.omnia_atas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE, -- A-0001, A-0002, etc.
  title TEXT NOT NULL,
  description TEXT,
  meeting_date DATE,
  secretary_id UUID REFERENCES public.omnia_users(id),
  status_id UUID REFERENCES public.omnia_statuses(id) NOT NULL,
  ticket TEXT,
  tags TEXT[] DEFAULT '{}',
  comment_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create omnia_attachments table
CREATE TABLE public.omnia_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ata_id UUID REFERENCES public.omnia_atas(id) ON DELETE CASCADE,
  comment_id UUID, -- Will reference omnia_comments after it's created
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  size_kb INTEGER,
  mime_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create omnia_comments table
CREATE TABLE public.omnia_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ata_id UUID REFERENCES public.omnia_atas(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES public.omnia_users(id) NOT NULL,
  body TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add foreign key constraint for attachments to comments
ALTER TABLE public.omnia_attachments 
ADD CONSTRAINT fk_attachments_comment 
FOREIGN KEY (comment_id) REFERENCES public.omnia_comments(id) ON DELETE CASCADE;

-- Enable Row Level Security
ALTER TABLE public.omnia_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.omnia_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.omnia_atas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.omnia_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.omnia_comments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for omnia_statuses (readable by all authenticated users)
CREATE POLICY "Anyone can view statuses" ON public.omnia_statuses
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage statuses" ON public.omnia_statuses
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.omnia_users 
      WHERE auth_user_id = auth.uid() AND role = 'ADMIN'
    )
  );

-- Create RLS policies for omnia_users
CREATE POLICY "Users can view all users" ON public.omnia_users
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own profile" ON public.omnia_users
  FOR UPDATE USING (auth_user_id = auth.uid());

CREATE POLICY "Admins can manage users" ON public.omnia_users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.omnia_users 
      WHERE auth_user_id = auth.uid() AND role = 'ADMIN'
    )
  );

-- Create RLS policies for omnia_atas
CREATE POLICY "Anyone can view atas" ON public.omnia_atas
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Secretarios and Admins can create atas" ON public.omnia_atas
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.omnia_users 
      WHERE auth_user_id = auth.uid() AND role IN ('ADMIN', 'SECRETARIO')
    )
  );

CREATE POLICY "Secretarios and Admins can update atas" ON public.omnia_atas
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.omnia_users 
      WHERE auth_user_id = auth.uid() AND role IN ('ADMIN', 'SECRETARIO')
    )
  );

CREATE POLICY "Admins can delete atas" ON public.omnia_atas
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.omnia_users 
      WHERE auth_user_id = auth.uid() AND role = 'ADMIN'
    )
  );

-- Create RLS policies for omnia_comments
CREATE POLICY "Anyone can view comments" ON public.omnia_comments
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create comments" ON public.omnia_comments
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own comments" ON public.omnia_comments
  FOR UPDATE USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.omnia_users 
      WHERE auth_user_id = auth.uid() AND role = 'ADMIN'
    )
  );

CREATE POLICY "Users can delete their own comments or admins can delete any" ON public.omnia_comments
  FOR DELETE USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.omnia_users 
      WHERE auth_user_id = auth.uid() AND role = 'ADMIN'
    )
  );

-- Create RLS policies for omnia_attachments
CREATE POLICY "Anyone can view attachments" ON public.omnia_attachments
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can upload attachments" ON public.omnia_attachments
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own attachments or admins can delete any" ON public.omnia_attachments
  FOR DELETE USING (
    uploaded_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.omnia_users 
      WHERE auth_user_id = auth.uid() AND role = 'ADMIN'
    )
  );

-- Create functions for updating timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_omnia_statuses_updated_at
  BEFORE UPDATE ON public.omnia_statuses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_omnia_users_updated_at
  BEFORE UPDATE ON public.omnia_users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_omnia_atas_updated_at
  BEFORE UPDATE ON public.omnia_atas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to update comment count
CREATE OR REPLACE FUNCTION public.update_ata_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.omnia_atas 
    SET comment_count = comment_count + 1 
    WHERE id = NEW.ata_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.omnia_atas 
    SET comment_count = comment_count - 1 
    WHERE id = OLD.ata_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for comment count updates
CREATE TRIGGER update_comment_count_trigger
  AFTER INSERT OR DELETE ON public.omnia_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ata_comment_count();

-- Insert initial status data
INSERT INTO public.omnia_statuses (name, color, order_position, is_default) VALUES
  ('Não iniciado', '#F59E0B', 1, true),
  ('Revisão/Correções', '#FBBF24', 2, false),
  ('Assinatura', '#F59E0B', 3, false),
  ('Em Andamento', '#3B82F6', 4, false),
  ('Concluído', '#10B981', 5, false),
  ('Cancelado', '#EF4444', 6, false),
  ('Pendente', '#8B5CF6', 7, false);