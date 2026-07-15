ALTER TABLE public.omnia_condominiums
  ADD COLUMN syndic_cpf TEXT,
  ADD COLUMN analista_assembleias TEXT,
  ADD COLUMN analista_assembleias_email TEXT;

COMMENT ON COLUMN public.omnia_condominiums.syndic_cpf IS 'CPF do síndico do condomínio (somente dígitos)';
COMMENT ON COLUMN public.omnia_condominiums.analista_assembleias IS 'Nome da analista de assembleias responsável pelo condomínio';
COMMENT ON COLUMN public.omnia_condominiums.analista_assembleias_email IS 'E-mail da analista de assembleias responsável pelo condomínio';
