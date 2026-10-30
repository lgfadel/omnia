-- O padrão também preenche todos os condomínios existentes com Londrina.
ALTER TABLE public.omnia_condominiums
  ADD COLUMN euro text NOT NULL DEFAULT 'Londrina'
  CONSTRAINT omnia_condominiums_euro_check CHECK (euro IN ('Londrina', 'Campinas'));

COMMENT ON COLUMN public.omnia_condominiums.euro IS
  'Escritório Euro responsável pelo condomínio: Londrina ou Campinas.';
