-- Create tags table
CREATE TABLE public.omnia_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on tags table
ALTER TABLE public.omnia_tags ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view all tags
CREATE POLICY "Anyone can view tags" 
ON public.omnia_tags 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Allow authenticated users to create tags
CREATE POLICY "Authenticated users can create tags" 
ON public.omnia_tags 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- Allow admins and creators to update tags
CREATE POLICY "Admins and creators can update tags" 
ON public.omnia_tags 
FOR UPDATE 
USING (
  public.is_admin_user(auth.uid()) OR 
  created_by = auth.uid()
);

-- Allow admins and creators to delete tags
CREATE POLICY "Admins and creators can delete tags" 
ON public.omnia_tags 
FOR DELETE 
USING (
  public.is_admin_user(auth.uid()) OR 
  created_by = auth.uid()
);

-- Add trigger to update updated_at
CREATE TRIGGER update_omnia_tags_updated_at
BEFORE UPDATE ON public.omnia_tags
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create tag-ata relationship table
CREATE TABLE public.omnia_ata_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ata_id UUID NOT NULL,
  tag_id UUID NOT NULL REFERENCES public.omnia_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(ata_id, tag_id)
);

-- Enable RLS on ata_tags table
ALTER TABLE public.omnia_ata_tags ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view ata-tag relationships
CREATE POLICY "Anyone can view ata tags" 
ON public.omnia_ata_tags 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Allow authenticated users to create ata-tag relationships
CREATE POLICY "Authenticated users can create ata tags" 
ON public.omnia_ata_tags 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to delete ata-tag relationships
CREATE POLICY "Authenticated users can delete ata tags" 
ON public.omnia_ata_tags 
FOR DELETE 
USING (auth.role() = 'authenticated');