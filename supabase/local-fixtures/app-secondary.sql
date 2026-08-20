-- Recursos complementares usados por CRM, protocolos, anexos e transcrições.

CREATE TABLE IF NOT EXISTS public.omnia_crm_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'NOVO',
  origem_id UUID REFERENCES public.omnia_crm_origens(id),
  administradora_atual TEXT, responsavel_negociacao TEXT,
  sindico_nome TEXT, sindico_email TEXT, sindico_telefone TEXT, sindico_whatsapp TEXT,
  cep TEXT, logradouro TEXT, numero TEXT, complemento TEXT, bairro TEXT, cidade TEXT, estado TEXT,
  numero_unidades INTEGER, numero_funcionarios_proprios INTEGER, numero_funcionarios_terceirizados INTEGER,
  valor_proposta NUMERIC, observacoes TEXT, comment_count INTEGER NOT NULL DEFAULT 0,
  assigned_to UUID REFERENCES public.omnia_users(id), created_by UUID REFERENCES public.omnia_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.omnia_crm_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.omnia_crm_leads(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.omnia_users(id), created_by UUID REFERENCES public.omnia_users(id),
  body TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.omnia_crm_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.omnia_crm_leads(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.omnia_crm_comments(id) ON DELETE CASCADE,
  name TEXT NOT NULL, url TEXT NOT NULL, size_kb NUMERIC, mime_type TEXT,
  uploaded_by UUID REFERENCES public.omnia_users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.omnia_admissao_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admissao_id UUID NOT NULL REFERENCES public.omnia_admissoes(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.omnia_users(id), body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.omnia_admissao_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admissao_id UUID NOT NULL REFERENCES public.omnia_admissoes(id) ON DELETE CASCADE,
  name TEXT NOT NULL, url TEXT NOT NULL, size_kb NUMERIC, mime_type TEXT,
  uploaded_by UUID REFERENCES public.omnia_users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.omnia_rescisao_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rescisao_id UUID NOT NULL REFERENCES public.omnia_rescisoes(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.omnia_users(id), body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.omnia_rescisao_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rescisao_id UUID NOT NULL REFERENCES public.omnia_rescisoes(id) ON DELETE CASCADE,
  name TEXT NOT NULL, url TEXT NOT NULL, size_kb NUMERIC, mime_type TEXT,
  uploaded_by UUID REFERENCES public.omnia_users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.omnia_protocolos ADD COLUMN IF NOT EXISTS numero BIGINT;
ALTER TABLE public.omnia_protocolos ADD COLUMN IF NOT EXISTS data_envio DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.omnia_protocolos ADD COLUMN IF NOT EXISTS quantidade_balancetes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.omnia_protocolos ADD COLUMN IF NOT EXISTS cancelado BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.omnia_protocolos ADD COLUMN IF NOT EXISTS cancelado_em TIMESTAMPTZ;
ALTER TABLE public.omnia_protocolos ADD COLUMN IF NOT EXISTS cancelado_por UUID REFERENCES public.omnia_users(id);
ALTER TABLE public.omnia_protocolos ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT;
ALTER TABLE public.omnia_protocolos ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.omnia_users(id);
ALTER TABLE public.omnia_protocolos ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS omnia_protocolos_numero_key ON public.omnia_protocolos(numero) WHERE numero IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.omnia_protocolo_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo_id UUID NOT NULL REFERENCES public.omnia_protocolos(id) ON DELETE CASCADE,
  name TEXT NOT NULL, url TEXT NOT NULL, size_kb NUMERIC, mime_type TEXT,
  uploaded_by UUID REFERENCES public.omnia_users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.omnia_balancete_protocol_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), original_filename TEXT NOT NULL, total_pages INTEGER NOT NULL DEFAULT 0,
  matched_count INTEGER NOT NULL DEFAULT 0, pending_count INTEGER NOT NULL DEFAULT 0, failed_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.omnia_users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.omnia_balancete_protocol_import_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.omnia_balancete_protocol_import_batches(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL, detected_protocol_number BIGINT, confidence TEXT NOT NULL DEFAULT 'low', status TEXT NOT NULL,
  protocolo_id UUID REFERENCES public.omnia_protocolos(id), balancete_id UUID REFERENCES public.omnia_balancetes(id),
  candidate_balancete_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[], page_file_name TEXT NOT NULL,
  page_file_path TEXT NOT NULL, page_file_url TEXT NOT NULL, error_message TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.omnia_ata_transcription_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), ata_id UUID NOT NULL REFERENCES public.omnia_atas(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', original_filename TEXT NOT NULL, error_message TEXT, attempt_count INTEGER NOT NULL DEFAULT 0,
  total_chunks INTEGER NOT NULL DEFAULT 0, processed_chunks INTEGER NOT NULL DEFAULT 0, stage TEXT, is_current BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.omnia_ata_transcriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), job_id UUID NOT NULL UNIQUE REFERENCES public.omnia_ata_transcription_jobs(id) ON DELETE CASCADE,
  raw_text TEXT NOT NULL, revised_text TEXT, language TEXT NOT NULL DEFAULT 'pt-BR', is_reviewed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.omnia_ata_transcription_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), transcription_id UUID NOT NULL REFERENCES public.omnia_ata_transcriptions(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL, start_ms INTEGER NOT NULL, end_ms INTEGER NOT NULL, speaker_label TEXT, speaker_name TEXT, text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(transcription_id, sequence)
);

CREATE TABLE IF NOT EXISTS public.omnia_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES public.omnia_users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, ata_id UUID REFERENCES public.omnia_atas(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.omnia_comments(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES public.omnia_tickets(id) ON DELETE CASCADE,
  ticket_comment_id UUID REFERENCES public.omnia_ticket_comments(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.omnia_users(id), read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'omnia_crm_leads', 'omnia_crm_comments', 'omnia_crm_attachments',
    'omnia_admissao_comments', 'omnia_admissao_attachments',
    'omnia_rescisao_comments', 'omnia_rescisao_attachments', 'omnia_protocolos',
    'omnia_protocolo_attachments', 'omnia_balancete_protocol_import_batches',
    'omnia_balancete_protocol_import_items', 'omnia_ata_transcription_jobs',
    'omnia_ata_transcriptions', 'omnia_ata_transcription_segments', 'omnia_notifications'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Authenticated users can access local data', table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', 'Authenticated users can access local data', table_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated, service_role', table_name);
  END LOOP;
END $$;
