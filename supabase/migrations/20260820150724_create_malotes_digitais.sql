CREATE TABLE public.omnia_malote_settings (
  singleton BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton),
  recipient_email TEXT NOT NULL DEFAULT '',
  default_subject_template TEXT NOT NULL DEFAULT 'Malote Digital — {{condominio}} — {{arquivo}}',
  default_body_template TEXT NOT NULL DEFAULT 'Prezados,\n\nSegue {{arquivo}} do {{condominio}} em {{data_envio}}.\n\nAtenciosamente,',
  updated_by UUID REFERENCES public.omnia_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.omnia_malote_settings (singleton)
VALUES (true)
ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE public.omnia_malote_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominium_id UUID NOT NULL REFERENCES public.omnia_condominiums(id) ON DELETE RESTRICT,
  recipient_email TEXT NOT NULL,
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES public.omnia_users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE public.omnia_malote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.omnia_malote_batches(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 18874368),
  content_type TEXT NOT NULL DEFAULT 'application/pdf' CHECK (content_type = 'application/pdf'),
  storage_path TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'uploaded', 'sending', 'sent', 'failed', 'purging', 'purged')),
  sent_at TIMESTAMPTZ,
  purged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.omnia_malote_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.omnia_malote_items(id) ON DELETE CASCADE,
  attempted_by UUID NOT NULL REFERENCES public.omnia_users(id) ON DELETE RESTRICT,
  recipient_email TEXT NOT NULL,
  rendered_subject TEXT NOT NULL,
  rendered_body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sending', 'sent', 'failed')),
  smtp_message_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((status = 'sending' AND smtp_message_id IS NULL AND error_message IS NULL) OR (status = 'sent' AND smtp_message_id IS NOT NULL AND error_message IS NULL) OR (status = 'failed' AND error_message IS NOT NULL))
);

CREATE INDEX idx_omnia_malote_batches_condominium_created_at
  ON public.omnia_malote_batches (condominium_id, created_at DESC);
CREATE INDEX idx_omnia_malote_items_batch_id ON public.omnia_malote_items (batch_id);
CREATE INDEX idx_omnia_malote_items_status_created_at ON public.omnia_malote_items (status, created_at);
CREATE INDEX idx_omnia_malote_attempts_item_created_at ON public.omnia_malote_attempts (item_id, created_at DESC);

CREATE TRIGGER update_omnia_malote_settings_updated_at
  BEFORE UPDATE ON public.omnia_malote_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_omnia_malote_items_updated_at
  BEFORE UPDATE ON public.omnia_malote_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.omnia_malote_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.omnia_malote_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.omnia_malote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.omnia_malote_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read malote settings"
  ON public.omnia_malote_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can update malote settings"
  ON public.omnia_malote_settings FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.omnia_users WHERE auth_user_id = auth.uid() AND 'ADMIN' = ANY(roles)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.omnia_users WHERE auth_user_id = auth.uid() AND 'ADMIN' = ANY(roles)));

CREATE POLICY "Authenticated users can read malote batches"
  ON public.omnia_malote_batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read malote items"
  ON public.omnia_malote_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read malote attempts"
  ON public.omnia_malote_attempts FOR SELECT TO authenticated USING (true);

GRANT SELECT ON public.omnia_malote_settings, public.omnia_malote_batches, public.omnia_malote_items, public.omnia_malote_attempts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.omnia_malote_settings, public.omnia_malote_batches, public.omnia_malote_items, public.omnia_malote_attempts TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('malote-attachments', 'malote-attachments', false, 18874368, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO public.omnia_menu_items (name, path, icon, parent_id, order_index, is_active)
VALUES ('Malotes', '/malotes', 'Send', NULL, 6, true)
ON CONFLICT (path) DO NOTHING;

INSERT INTO public.omnia_menu_items (name, path, icon, parent_id, order_index, is_active)
SELECT 'Malotes', '/config/malotes', 'Settings2', id, 99, true
FROM public.omnia_menu_items
WHERE path = '/config'
ON CONFLICT (path) DO NOTHING;

INSERT INTO public.omnia_role_permissions (role_name, menu_item_id, can_access)
SELECT role_name, menu_item.id, true
FROM (VALUES ('ADMIN'), ('SECRETARIO'), ('USUARIO')) AS roles(role_name)
CROSS JOIN (SELECT id FROM public.omnia_menu_items WHERE path = '/malotes') AS menu_item
ON CONFLICT (role_name, menu_item_id) DO UPDATE SET can_access = EXCLUDED.can_access;

INSERT INTO public.omnia_role_permissions (role_name, menu_item_id, can_access)
SELECT 'ADMIN', id, true
FROM public.omnia_menu_items
WHERE path = '/config/malotes'
ON CONFLICT (role_name, menu_item_id) DO UPDATE SET can_access = EXCLUDED.can_access;

COMMENT ON TABLE public.omnia_malote_settings IS 'Configuração global de destinatário e modelos de e-mail de malotes digitais';
COMMENT ON TABLE public.omnia_malote_batches IS 'Lotes de malotes digitais enviados para um condomínio';
COMMENT ON TABLE public.omnia_malote_items IS 'Arquivos PDF individuais de um malote digital';
COMMENT ON TABLE public.omnia_malote_attempts IS 'Log imutável das tentativas de envio de cada arquivo de malote';
