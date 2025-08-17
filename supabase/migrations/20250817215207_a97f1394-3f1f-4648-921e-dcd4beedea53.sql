-- Add responsible_id column to omnia_atas table
ALTER TABLE public.omnia_atas 
ADD COLUMN responsible_id uuid REFERENCES public.omnia_users(id);

-- Add index for performance
CREATE INDEX idx_omnia_atas_responsible_id ON public.omnia_atas(responsible_id);