CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.omnia_user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.omnia_users(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES public.omnia_menu_items(id) ON DELETE CASCADE,
  can_access BOOLEAN NOT NULL DEFAULT true,
  granted_by UUID REFERENCES public.omnia_users(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, menu_item_id)
);

CREATE TABLE IF NOT EXISTS public.omnia_administradoras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'Administradora',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.omnia_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#2563EB',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.omnia_crm_origens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  order_position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.omnia_crm_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#2563EB',
  order_position INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.omnia_condominiums ADD COLUMN IF NOT EXISTS cnpj TEXT;
ALTER TABLE public.omnia_condominiums ADD COLUMN IF NOT EXISTS street TEXT;
ALTER TABLE public.omnia_condominiums ADD COLUMN IF NOT EXISTS number TEXT;
ALTER TABLE public.omnia_condominiums ADD COLUMN IF NOT EXISTS neighborhood TEXT;
ALTER TABLE public.omnia_condominiums ADD COLUMN IF NOT EXISTS balancete_digital BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.omnia_condominiums ADD COLUMN IF NOT EXISTS boleto_impresso BOOLEAN NOT NULL DEFAULT false;

INSERT INTO public.omnia_menu_items (name, path, icon, order_index)
VALUES
  ('Dashboard', '/', 'LayoutDashboard', 1),
  ('Atas', '/atas', 'FileText', 2),
  ('Tarefas', '/tarefas', 'CheckSquare', 3),
  ('Admissões', '/admissoes', 'UserPlus', 4),
  ('Rescisões', '/rescisoes', 'UserMinus', 5),
  ('Malotes', '/malotes', 'Send', 6),
  ('Balancetes', '/balancetes', 'Receipt', 7),
  ('Configurações', '/config', 'Settings', 99)
ON CONFLICT (path) DO UPDATE SET name = EXCLUDED.name, icon = EXCLUDED.icon, order_index = EXCLUDED.order_index;

ALTER TABLE public.omnia_user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.omnia_administradoras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.omnia_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.omnia_crm_origens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.omnia_crm_statuses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read local user permissions" ON public.omnia_user_permissions;
CREATE POLICY "Authenticated users can read local user permissions" ON public.omnia_user_permissions FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can read local administradoras" ON public.omnia_administradoras;
CREATE POLICY "Authenticated users can read local administradoras" ON public.omnia_administradoras FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can read local tags" ON public.omnia_tags;
CREATE POLICY "Authenticated users can read local tags" ON public.omnia_tags FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can read local crm origins" ON public.omnia_crm_origens;
CREATE POLICY "Authenticated users can read local crm origins" ON public.omnia_crm_origens FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can read local crm statuses" ON public.omnia_crm_statuses;
CREATE POLICY "Authenticated users can read local crm statuses" ON public.omnia_crm_statuses FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.omnia_user_permissions, public.omnia_administradoras, public.omnia_tags, public.omnia_crm_origens, public.omnia_crm_statuses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.omnia_user_permissions, public.omnia_administradoras, public.omnia_tags, public.omnia_crm_origens, public.omnia_crm_statuses TO service_role;
