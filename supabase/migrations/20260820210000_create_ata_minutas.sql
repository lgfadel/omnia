-- Segundo passo do fluxo de transcrição: gerar a ata a partir do texto revisado e
-- refiná-la por chat, no lugar do fluxo manual hoje feito fora do Omnia (exportar o
-- .txt, subir no ChatGPT junto da convocação e das apurações de votação, e pedir
-- correções em conversa). Ver docs/superpowers/specs/2026-08-20-minuta-de-ata-design.md.

CREATE TABLE public.omnia_ata_minuta_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  model text NOT NULL DEFAULT 'gpt-5.6-sol',
  reasoning_effort text NOT NULL DEFAULT 'high' CHECK (reasoning_effort IN ('none', 'low', 'medium', 'high', 'xhigh', 'max')),
  system_prompt text NOT NULL DEFAULT $$Você é o secretário de uma assembleia de condomínio. A partir da transcrição fornecida, escreva a ata da assembleia. Divida a ata de acordo com os assuntos da pauta listada na convocação anexa. Cada seção começa com um título curto do item de pauta, precedido de "## ", seguido de 3 a 4 parágrafos. Não use bullet points. Escreva na mesma língua da transcrição. Não deixe de fora nenhuma informação importante e não invente nada: atenha-se às informações dos arquivos anexos. Quando houver PDF de apuração de votação, use os números exatos dele. Resuma apenas os itens da pauta, sem cabeçalho e sem rodapé.$$,
  updated_by uuid REFERENCES public.omnia_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.omnia_ata_minuta_settings (singleton) VALUES (true)
ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE public.omnia_ata_minutas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ata_id uuid NOT NULL REFERENCES public.omnia_atas(id) ON DELETE CASCADE,
  transcription_id uuid REFERENCES public.omnia_ata_transcriptions(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES public.omnia_users(id) ON DELETE RESTRICT,
  content text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'generating' CHECK (status IN ('generating', 'ready', 'failed')),
  error_message text,
  model text,
  usage jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_current boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX omnia_ata_minutas_one_current_per_ata
  ON public.omnia_ata_minutas (ata_id)
  WHERE is_current;

CREATE INDEX omnia_ata_minutas_ata_id_idx
  ON public.omnia_ata_minutas (ata_id, created_at DESC);

CREATE TABLE public.omnia_ata_minuta_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  minuta_id uuid NOT NULL REFERENCES public.omnia_ata_minutas(id) ON DELETE CASCADE,
  sequence integer NOT NULL CHECK (sequence >= 0),
  content text NOT NULL,
  origin text NOT NULL CHECK (origin IN ('generation', 'chat', 'manual')),
  created_by uuid NOT NULL REFERENCES public.omnia_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (minuta_id, sequence)
);

CREATE INDEX omnia_ata_minuta_versions_minuta_idx
  ON public.omnia_ata_minuta_versions (minuta_id, sequence DESC);

CREATE TABLE public.omnia_ata_minuta_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  minuta_id uuid NOT NULL REFERENCES public.omnia_ata_minutas(id) ON DELETE CASCADE,
  sequence integer NOT NULL CHECK (sequence >= 0),
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  version_id uuid REFERENCES public.omnia_ata_minuta_versions(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.omnia_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (minuta_id, sequence)
);

CREATE INDEX omnia_ata_minuta_messages_minuta_idx
  ON public.omnia_ata_minuta_messages (minuta_id, sequence);

-- Preso à ata, não à minuta: um documento de apoio (convocação, apuração de votação)
-- sobrevive a uma regeração da minuta atual.
CREATE TABLE public.omnia_ata_minuta_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ata_id uuid NOT NULL REFERENCES public.omnia_atas(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'outro' CHECK (kind IN ('convocacao', 'apuracao', 'outro')),
  storage_path text NOT NULL UNIQUE,
  original_filename text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes > 0),
  created_by uuid NOT NULL REFERENCES public.omnia_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX omnia_ata_minuta_documents_ata_id_idx
  ON public.omnia_ata_minuta_documents (ata_id, created_at DESC);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('ata-minuta-documents', 'ata-minuta-documents', false, 26214400, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE TRIGGER update_omnia_ata_minuta_settings_updated_at
  BEFORE UPDATE ON public.omnia_ata_minuta_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_omnia_ata_minutas_updated_at
  BEFORE UPDATE ON public.omnia_ata_minutas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.omnia_ata_minuta_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.omnia_ata_minutas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.omnia_ata_minuta_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.omnia_ata_minuta_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.omnia_ata_minuta_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read minuta settings"
  ON public.omnia_ata_minuta_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can update minuta settings"
  ON public.omnia_ata_minuta_settings FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.omnia_users WHERE auth_user_id = (SELECT auth.uid()) AND 'ADMIN' = ANY(roles)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.omnia_users WHERE auth_user_id = (SELECT auth.uid()) AND 'ADMIN' = ANY(roles)));

CREATE POLICY "Ata minuta team can view minutas"
ON public.omnia_ata_minutas FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.omnia_users u
    LEFT JOIN public.omnia_atas a ON a.id = omnia_ata_minutas.ata_id
    WHERE u.auth_user_id = (SELECT auth.uid())
      AND (u.roles && ARRAY['ADMIN', 'SECRETARIO'] OR a.responsible_id = u.id)
  )
);

CREATE POLICY "Ata minuta team can update minutas"
ON public.omnia_ata_minutas FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.omnia_users u
    LEFT JOIN public.omnia_atas a ON a.id = omnia_ata_minutas.ata_id
    WHERE u.auth_user_id = (SELECT auth.uid())
      AND (u.roles && ARRAY['ADMIN', 'SECRETARIO'] OR a.responsible_id = u.id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.omnia_users u
    LEFT JOIN public.omnia_atas a ON a.id = omnia_ata_minutas.ata_id
    WHERE u.auth_user_id = (SELECT auth.uid())
      AND (u.roles && ARRAY['ADMIN', 'SECRETARIO'] OR a.responsible_id = u.id)
  )
);

CREATE POLICY "Ata minuta team can view versions"
ON public.omnia_ata_minuta_versions FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.omnia_ata_minutas m
    JOIN public.omnia_atas a ON a.id = m.ata_id
    JOIN public.omnia_users u ON u.auth_user_id = (SELECT auth.uid())
    WHERE m.id = omnia_ata_minuta_versions.minuta_id
      AND (u.roles && ARRAY['ADMIN', 'SECRETARIO'] OR a.responsible_id = u.id)
  )
);

CREATE POLICY "Ata minuta team can view messages"
ON public.omnia_ata_minuta_messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.omnia_ata_minutas m
    JOIN public.omnia_atas a ON a.id = m.ata_id
    JOIN public.omnia_users u ON u.auth_user_id = (SELECT auth.uid())
    WHERE m.id = omnia_ata_minuta_messages.minuta_id
      AND (u.roles && ARRAY['ADMIN', 'SECRETARIO'] OR a.responsible_id = u.id)
  )
);

CREATE POLICY "Ata minuta team can view documents"
ON public.omnia_ata_minuta_documents FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.omnia_users u
    LEFT JOIN public.omnia_atas a ON a.id = omnia_ata_minuta_documents.ata_id
    WHERE u.auth_user_id = (SELECT auth.uid())
      AND (u.roles && ARRAY['ADMIN', 'SECRETARIO'] OR a.responsible_id = u.id)
  )
);

GRANT SELECT ON public.omnia_ata_minuta_settings TO authenticated;
GRANT SELECT ON public.omnia_ata_minutas, public.omnia_ata_minuta_versions, public.omnia_ata_minuta_messages, public.omnia_ata_minuta_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.omnia_ata_minuta_settings, public.omnia_ata_minutas, public.omnia_ata_minuta_versions, public.omnia_ata_minuta_messages, public.omnia_ata_minuta_documents TO service_role;

INSERT INTO public.omnia_menu_items (name, path, icon, parent_id, order_index, is_active)
SELECT 'Atas', '/config/atas', 'FileText', id, 99, true
FROM public.omnia_menu_items
WHERE path = '/config'
ON CONFLICT (path) DO NOTHING;

INSERT INTO public.omnia_role_permissions (role_name, menu_item_id, can_access)
SELECT 'ADMIN', id, true
FROM public.omnia_menu_items
WHERE path = '/config/atas'
ON CONFLICT (role_name, menu_item_id) DO UPDATE SET can_access = EXCLUDED.can_access;

COMMENT ON TABLE public.omnia_ata_minuta_settings IS 'Configuração global do modelo, esforço de raciocínio e prompt usados na geração da minuta de ATA';
COMMENT ON TABLE public.omnia_ata_minutas IS 'Minuta de ATA atual de cada ata, gerada a partir da transcrição revisada e refinável por chat';
COMMENT ON TABLE public.omnia_ata_minuta_versions IS 'Histórico de versões do texto da minuta, uma por geração/turno de chat/edição manual';
COMMENT ON TABLE public.omnia_ata_minuta_messages IS 'Histórico do chat de refinamento da minuta';
COMMENT ON TABLE public.omnia_ata_minuta_documents IS 'PDFs de apoio (convocação, apuração de votação) usados na geração da minuta, presos à ata';
