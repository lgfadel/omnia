CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.omnia_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  roles TEXT[] NOT NULL DEFAULT ARRAY['USUARIO'],
  avatar_url TEXT,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.omnia_condominiums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city TEXT,
  state TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.omnia_menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  icon TEXT,
  parent_id UUID REFERENCES public.omnia_menu_items(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.omnia_role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name TEXT NOT NULL,
  menu_item_id UUID NOT NULL REFERENCES public.omnia_menu_items(id) ON DELETE CASCADE,
  can_access BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (role_name, menu_item_id)
);

ALTER TABLE public.omnia_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.omnia_condominiums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.omnia_menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.omnia_role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read local users" ON public.omnia_users;
CREATE POLICY "Authenticated users can read local users" ON public.omnia_users FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can read local condominiums" ON public.omnia_condominiums;
CREATE POLICY "Authenticated users can read local condominiums" ON public.omnia_condominiums FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can read local menu items" ON public.omnia_menu_items;
CREATE POLICY "Authenticated users can read local menu items" ON public.omnia_menu_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can read local role permissions" ON public.omnia_role_permissions;
CREATE POLICY "Authenticated users can read local role permissions" ON public.omnia_role_permissions FOR SELECT TO authenticated USING (true);

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.omnia_users, public.omnia_condominiums, public.omnia_menu_items, public.omnia_role_permissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.omnia_users, public.omnia_condominiums, public.omnia_menu_items, public.omnia_role_permissions TO service_role;

INSERT INTO public.omnia_condominiums (name, city, state)
SELECT fixture.name, fixture.city, fixture.state
FROM (VALUES
  ('Condomínio Jardim Paulista', 'São Paulo', 'SP'),
  ('Condomínio Vila Mariana', 'São Paulo', 'SP')
) AS fixture(name, city, state)
WHERE NOT EXISTS (SELECT 1 FROM public.omnia_condominiums current WHERE current.name = fixture.name);

INSERT INTO public.omnia_menu_items (name, path, icon, order_index)
VALUES ('Configurações', '/config', 'Settings', 99)
ON CONFLICT (path) DO NOTHING;
