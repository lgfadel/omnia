-- omnia_ata_minutas.usage é sobrescrito a cada turno (geração ou chat) — comparar o
-- custo de duas versões geradas com modelos diferentes na mesma minuta (ex.: sol vs.
-- luna) perdia o consumo da primeira assim que a segunda terminava. O consumo agora
-- fica preso à própria versão, que nunca é sobrescrita.
ALTER TABLE public.omnia_ata_minuta_versions
  ADD COLUMN model text,
  ADD COLUMN usage jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.omnia_ata_minuta_versions.model IS 'Id do modelo usado para gerar esta versão específica.';
COMMENT ON COLUMN public.omnia_ata_minuta_versions.usage IS 'Consumo de tokens desta versão específica, como devolvido pela Responses API.';
