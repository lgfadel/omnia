ALTER TABLE public.omnia_condominiums
  ADD COLUMN analista_financeiro TEXT;

COMMENT ON COLUMN public.omnia_condominiums.analista_financeiro IS 'Nome do analista financeiro responsável pelo condomínio';
