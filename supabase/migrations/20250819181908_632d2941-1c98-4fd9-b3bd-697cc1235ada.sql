-- Configurar realtime para a tabela omnia_atas
ALTER TABLE public.omnia_atas REPLICA IDENTITY FULL;

-- Adicionar a tabela à publicação realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.omnia_atas;