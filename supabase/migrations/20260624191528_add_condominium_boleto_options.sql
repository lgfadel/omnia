ALTER TABLE public.omnia_condominiums
  ADD COLUMN boleto_due_day integer,
  ADD COLUMN boleto_observations text,
  ADD COLUMN boleto_delivery_type text,
  ADD COLUMN garantidora boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT omnia_condominiums_boleto_due_day_check
    CHECK (boleto_due_day IS NULL OR boleto_due_day BETWEEN 1 AND 31),
  ADD CONSTRAINT omnia_condominiums_boleto_delivery_type_check
    CHECK (
      boleto_delivery_type IS NULL
      OR boleto_delivery_type IN ('nao', 'fisico_total', 'fisico_parcial', 'lista')
    );

UPDATE public.omnia_condominiums
SET boleto_delivery_type = 'nao'
WHERE boleto_delivery_type IS NULL;

ALTER TABLE public.omnia_condominiums
  ALTER COLUMN boleto_delivery_type SET DEFAULT 'nao',
  ALTER COLUMN boleto_delivery_type SET NOT NULL;

COMMENT ON COLUMN public.omnia_condominiums.boleto_due_day IS 'Dia do mês para vencimento dos boletos do condomínio';
COMMENT ON COLUMN public.omnia_condominiums.boleto_observations IS 'Observações e detalhes especiais para emissão de boletos do condomínio';
COMMENT ON COLUMN public.omnia_condominiums.boleto_delivery_type IS 'Tipo de entrega/impressão dos boletos: nao, fisico_total, fisico_parcial ou lista';
COMMENT ON COLUMN public.omnia_condominiums.garantidora IS 'Indica se o condomínio utiliza garantidora';
