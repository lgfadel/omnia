-- Aplicada em produção via dashboard, sem arquivo local correspondente.
-- Versão original em supabase_migrations.schema_migrations: 20260113181911
-- Arquivada antes do repair --status reverted que reconciliou o histórico.

-- Criar bucket de storage para admissões
INSERT INTO storage.buckets (id, name, public)
VALUES ('admissoes', 'admissoes', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage
CREATE POLICY "Usuários podem fazer upload em admissoes"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'admissoes');

CREATE POLICY "Usuários podem ler arquivos de admissoes"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'admissoes');

CREATE POLICY "Usuários podem deletar arquivos de admissoes"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'admissoes');
