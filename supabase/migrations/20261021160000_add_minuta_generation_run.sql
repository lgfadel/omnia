-- A geração da minuta passou a rodar em segundo plano na OpenAI (background mode),
-- fora do teto de 300s da função da Vercel. A função só acompanha o stream por uma
-- janela e entrega a vez; quem retoma precisa saber qual resposta seguir e como
-- fechar o turno (versão de geração ou de chat, com ou sem mensagem do assistente).
-- Fica nula fora de uma geração em andamento: é limpa ao concluir ou falhar.
ALTER TABLE public.omnia_ata_minutas
  ADD COLUMN generation_run jsonb;

ALTER TABLE public.omnia_ata_minutas
  ADD CONSTRAINT omnia_ata_minutas_generation_run_only_while_generating
  CHECK (generation_run IS NULL OR status = 'generating');

COMMENT ON COLUMN public.omnia_ata_minutas.generation_run IS
  'Geração em andamento na OpenAI: {response_id, origin (generation|chat), with_instruction, model}. Nula quando não há geração em curso.';
