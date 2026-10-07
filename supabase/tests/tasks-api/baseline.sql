-- Sanitized production-equivalent fixture. Local isolated database only.
DROP SCHEMA IF EXISTS tasks_api_private CASCADE;
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public AUTHORIZATION postgres;
CREATE SCHEMA IF NOT EXISTS auth;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT USAGE ON SCHEMA public, auth TO authenticated, anon, service_role;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claim.sub',true),''), nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claim.role',true),''), nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role') $$;
-- DDL exercises Supabase's non-superuser migration role, not supabase_admin.
GRANT USAGE ON SCHEMA auth TO authenticated;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='omnia_tasks_worker') THEN
  GRANT omnia_tasks_worker TO postgres WITH ADMIN OPTION;
  REVOKE USAGE ON SCHEMA auth FROM omnia_tasks_worker;
  REVOKE EXECUTE ON FUNCTION auth.uid(),auth.role() FROM omnia_tasks_worker;
END IF; END $$;
SET ROLE postgres;
CREATE TYPE public.ticket_priority AS ENUM ('URGENTE','ALTA','NORMAL','BAIXA');
CREATE TYPE public.ticket_recurrence_frequency AS ENUM ('DAILY','WEEKLY','MONTHLY');
CREATE TYPE public.ticket_recurrence_end_type AS ENUM ('NEVER','ON_DATE','AFTER_COUNT');
CREATE TABLE public.omnia_menu_items (
"id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
"name" text NOT NULL,
"path" text NOT NULL,
"icon" text,
"parent_id" uuid,
"order_index" integer DEFAULT 0 NOT NULL,
"is_active" boolean DEFAULT true,
"created_at" timestamp with time zone DEFAULT now(),
"updated_at" timestamp with time zone DEFAULT now()
);
ALTER TABLE public.omnia_menu_items ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.omnia_notifications (
"id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
"user_id" uuid NOT NULL,
"type" text NOT NULL,
"ticket_id" uuid,
"comment_id" uuid,
"created_by" uuid,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"read_at" timestamp with time zone,
"ticket_comment_id" uuid,
"ata_id" uuid
);
ALTER TABLE public.omnia_notifications ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.omnia_ticket_recurrences (
"id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
"template_ticket_id" uuid,
"frequency" public.ticket_recurrence_frequency NOT NULL,
"interval" integer DEFAULT 1 NOT NULL,
"start_date" date NOT NULL,
"end_type" public.ticket_recurrence_end_type DEFAULT 'NEVER'::ticket_recurrence_end_type NOT NULL,
"end_date" date,
"occurrence_limit" integer,
"generated_occurrences" integer DEFAULT 1 NOT NULL,
"next_occurrence_date" date,
"is_active" boolean DEFAULT true NOT NULL,
"title" text NOT NULL,
"description" text,
"priority" public.ticket_priority DEFAULT 'NORMAL'::ticket_priority NOT NULL,
"status_id" uuid NOT NULL,
"assigned_to" uuid,
"created_by" uuid,
"oportunidade_id" uuid,
"tags" text[] DEFAULT '{}'::text[] NOT NULL,
"is_private" boolean DEFAULT false NOT NULL,
"ticket_octa" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.omnia_ticket_recurrences ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.omnia_ticket_statuses (
"id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
"name" text NOT NULL,
"color" text NOT NULL,
"order_position" integer NOT NULL,
"is_default" boolean DEFAULT false,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"is_final" boolean DEFAULT false NOT NULL
);
ALTER TABLE public.omnia_ticket_statuses ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.omnia_tags (
"id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
"name" text NOT NULL UNIQUE,
"color" text DEFAULT '#6366f1' NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"created_by" uuid,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.omnia_tags ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.omnia_tickets (
"id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
"title" text NOT NULL,
"description" text,
"priority" public.ticket_priority DEFAULT 'NORMAL'::ticket_priority NOT NULL,
"due_date" date,
"ticket_octa" text,
"status_id" uuid NOT NULL,
"assigned_to" uuid,
"created_by" uuid,
"tags" text[] DEFAULT '{}'::text[],
"comment_count" integer DEFAULT 0,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"is_private" boolean DEFAULT false,
"oportunidade_id" uuid,
"attachment_count" integer DEFAULT 0 NOT NULL,
"ticket_id" integer NOT NULL,
"recurrence_id" uuid,
"recurrence_occurrence" integer
);
ALTER TABLE public.omnia_tickets ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.omnia_users (
"id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
"auth_user_id" uuid,
"name" text NOT NULL,
"email" text NOT NULL,
"avatar_url" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"roles" text[] DEFAULT ARRAY['USUARIO'::text],
"color" text DEFAULT '#6366f1'::text,
"active" boolean DEFAULT true
);
ALTER TABLE public.omnia_users ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.omnia_user_permissions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES public.omnia_users, menu_item_id uuid REFERENCES public.omnia_menu_items, can_access boolean NOT NULL, UNIQUE(user_id,menu_item_id));
CREATE TABLE public.omnia_role_permissions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), role_name text NOT NULL, menu_item_id uuid REFERENCES public.omnia_menu_items, can_access boolean NOT NULL, UNIQUE(role_name,menu_item_id));
CREATE TABLE public.omnia_crm_leads (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
ALTER TABLE public.omnia_tickets ADD FOREIGN KEY (status_id) REFERENCES public.omnia_ticket_statuses, ADD FOREIGN KEY (assigned_to) REFERENCES public.omnia_users, ADD FOREIGN KEY (created_by) REFERENCES public.omnia_users, ADD FOREIGN KEY (recurrence_id) REFERENCES public.omnia_ticket_recurrences, ADD FOREIGN KEY (oportunidade_id) REFERENCES public.omnia_crm_leads;
CREATE UNIQUE INDEX ON public.omnia_tickets(ticket_id);
CREATE UNIQUE INDEX idx_omnia_tickets_recurrence_occurrence ON public.omnia_tickets(recurrence_id, recurrence_occurrence) WHERE recurrence_id IS NOT NULL AND recurrence_occurrence IS NOT NULL;
CREATE UNIQUE INDEX ON public.omnia_users(auth_user_id);
CREATE SEQUENCE public.omnia_tickets_ticket_id_seq;
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=clock_timestamp(); RETURN NEW; END $$;
CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON public.omnia_tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE FUNCTION public.set_omnia_tickets_ticket_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ticket_id IS NULL THEN
    NEW.ticket_id := nextval('public.omnia_tickets_ticket_id_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_omnia_tickets_ticket_id_trigger ON public.omnia_tickets;

CREATE TRIGGER set_omnia_tickets_ticket_id_trigger
BEFORE INSERT ON public.omnia_tickets
FOR EACH ROW
EXECUTE FUNCTION public.set_omnia_tickets_ticket_id();

CREATE INDEX IF NOT EXISTS idx_omnia_tickets_ticket_id
ON public.omnia_tickets(ticket_id);
-- Create new policies that avoid recursion
-- Policy for viewing users - simplified to avoid recursion
CREATE POLICY "Users can view all users"
ON public.omnia_users
FOR SELECT
USING (auth.role() = 'authenticated');

-- Policy for users to update their own profile
CREATE POLICY "Users can update their own profile"
ON public.omnia_users
FOR UPDATE
USING (auth_user_id = auth.uid());

-- Policy for users to insert their own profile
CREATE POLICY "Users can insert their own profile"
ON public.omnia_users
FOR INSERT
WITH CHECK (auth_user_id = auth.uid());

-- Policy for admins to manage users - use a function to avoid recursion
CREATE OR REPLACE FUNCTION public.is_admin_user(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.omnia_users
    WHERE auth_user_id = user_id
    AND 'ADMIN' = ANY(roles)
  );
$$;

-- Admin policy using the function
CREATE POLICY "Admins can manage users"
ON public.omnia_users
FOR ALL
USING (public.is_admin_user(auth.uid()));

-- Policy for admin delete operations
CREATE POLICY "Admins can delete users"
ON public.omnia_users
FOR DELETE
USING (public.is_admin_user(auth.uid()));-- Corrigir políticas RLS para tarefas privadas
-- O problema é que as políticas estavam comparando assigned_to e created_by com auth.uid()
-- mas esses campos referenciam omnia_users.id, não auth_user_id

-- Atualizar política de criação para validar tarefas privadas
DROP POLICY IF EXISTS "Authenticated users can create tickets" ON public.omnia_tickets;

CREATE POLICY "Authenticated users can create tickets"
ON public.omnia_tickets
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM omnia_users
    WHERE omnia_users.auth_user_id = auth.uid()
    AND omnia_users.roles && ARRAY['ADMIN'::text, 'SECRETARIO'::text, 'USUARIO'::text]
  ) AND (
    -- Se for tarefa privada, assigned_to deve ser NULL ou o id do omnia_users do criador
    (is_private = false) OR
    (is_private = true AND (
      assigned_to IS NULL OR
      assigned_to = (
        SELECT id FROM omnia_users WHERE auth_user_id = auth.uid()
      )
    ))
  )
);

-- Atualizar política de edição para validar tarefas privadas
DROP POLICY IF EXISTS "Authenticated users can update tickets" ON public.omnia_tickets;

CREATE POLICY "Authenticated users can update tickets"
ON public.omnia_tickets
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM omnia_users
    WHERE omnia_users.auth_user_id = auth.uid()
    AND omnia_users.roles && ARRAY['ADMIN'::text, 'SECRETARIO'::text, 'USUARIO'::text]
  ) AND (
    -- Pode editar se não for privada, ou se for o criador, ou se for admin
    (is_private = false) OR
    (created_by = (
      SELECT id FROM omnia_users WHERE auth_user_id = auth.uid()
    )) OR
    EXISTS(
      SELECT 1 FROM omnia_users
      WHERE auth_user_id = auth.uid()
      AND 'ADMIN' = ANY(roles)
    )
  )
) WITH CHECK (
  -- Validações para atualização
  (is_private = false) OR
  (is_private = true AND (
    assigned_to IS NULL OR
    assigned_to = (
      SELECT id FROM omnia_users WHERE auth_user_id = auth.uid()
    )
  ))
);

-- Comentário explicativo
COMMENT ON COLUMN public.omnia_tickets.is_private IS 'Indica se a tarefa é privada (visível apenas ao criador e admins). As políticas RLS foram corrigidas para usar omnia_users.id em vez de auth.uid() nas comparações.';CREATE POLICY "Users can view public tickets or their own private tickets" ON public.omnia_tickets FOR SELECT USING (auth.role()='authenticated' AND (NOT coalesce(is_private,false) OR created_by=(SELECT id FROM public.omnia_users WHERE auth_user_id=auth.uid()) OR public.is_admin_user(auth.uid())));
CREATE POLICY statuses_read ON public.omnia_ticket_statuses FOR SELECT USING (auth.role()='authenticated');
CREATE POLICY tags_read ON public.omnia_tags FOR SELECT USING (auth.role()='authenticated');
CREATE POLICY recurrences_read ON public.omnia_ticket_recurrences FOR SELECT USING (auth.role()='authenticated');
CREATE POLICY recurrences_insert ON public.omnia_ticket_recurrences FOR INSERT WITH CHECK (auth.role()='authenticated');
CREATE POLICY recurrences_update ON public.omnia_ticket_recurrences FOR UPDATE USING (auth.role()='authenticated');
-- Migration: Update permission functions to use omnia_ prefixed tables
-- Created: 2025-01-15
-- Description: Updates permission functions to reference omnia_user_permissions and omnia_menu_items

-- Function to check if a user has permission to access a menu item
CREATE OR REPLACE FUNCTION check_user_menu_permission(
  p_user_id UUID,
  p_menu_item_path TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_menu_item_id UUID;
  v_user_roles TEXT[];
  v_specific_permission BOOLEAN;
  v_role_permission BOOLEAN;
  v_role TEXT;
BEGIN
  -- Get menu item ID from path
  SELECT id INTO v_menu_item_id
  FROM omnia_menu_items
  WHERE path = p_menu_item_path AND is_active = true;

  -- If menu item doesn't exist, deny access
  IF v_menu_item_id IS NULL THEN
    RETURN false;
  END IF;

  -- Get user roles
  SELECT roles INTO v_user_roles
  FROM omnia_users
  WHERE id = p_user_id;

  -- If user doesn't exist, deny access
  IF v_user_roles IS NULL THEN
    RETURN false;
  END IF;

  -- Check for specific user permission (overrides role permissions)
  SELECT can_access INTO v_specific_permission
  FROM omnia_user_permissions
  WHERE user_id = p_user_id AND menu_item_id = v_menu_item_id;

  -- If specific permission exists, use it
  IF v_specific_permission IS NOT NULL THEN
    RETURN v_specific_permission;
  END IF;

  -- Check role-based permissions
  -- If user has ADMIN role, check ADMIN permissions first
  IF 'ADMIN' = ANY(v_user_roles) THEN
    SELECT can_access INTO v_role_permission
    FROM omnia_role_permissions
    WHERE role_name = 'ADMIN' AND menu_item_id = v_menu_item_id;

    IF v_role_permission IS NOT NULL THEN
      RETURN v_role_permission;
    END IF;
  END IF;

  -- Check other roles in order of priority: SECRETARIO, then USUARIO
  FOREACH v_role IN ARRAY v_user_roles LOOP
    IF v_role IN ('SECRETARIO', 'USUARIO') THEN
      SELECT can_access INTO v_role_permission
      FROM omnia_role_permissions
      WHERE role_name = v_role AND menu_item_id = v_menu_item_id;

      IF v_role_permission IS NOT NULL THEN
        RETURN v_role_permission;
      END IF;
    END IF;
  END LOOP;

  -- Default: deny access if no permission found
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_ticket_recurrence_interval(
  p_date date,
  p_frequency public.ticket_recurrence_frequency,
  p_interval integer
)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  safe_interval integer := GREATEST(1, p_interval);
BEGIN
  IF p_frequency = 'DAILY' THEN
    RETURN p_date + safe_interval;
  ELSIF p_frequency = 'WEEKLY' THEN
    RETURN p_date + (safe_interval * 7);
  END IF;

  RETURN (p_date + (safe_interval || ' months')::interval)::date;
END;
$$;

CREATE OR REPLACE FUNCTION public.touch_omnia_ticket_recurrences_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_omnia_ticket_recurrences_updated_at_trigger ON public.omnia_ticket_recurrences;
CREATE TRIGGER touch_omnia_ticket_recurrences_updated_at_trigger
BEFORE UPDATE ON public.omnia_ticket_recurrences
FOR EACH ROW
EXECUTE FUNCTION public.touch_omnia_ticket_recurrences_updated_at();

CREATE OR REPLACE FUNCTION public.generate_omnia_ticket_recurrences(p_run_date date DEFAULT current_date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recurrence_record public.omnia_ticket_recurrences%ROWTYPE;
  generated_count integer := 0;
  next_occurrence_number integer;
  next_due_date date;
  inserted_ticket_id uuid;
BEGIN
  FOR recurrence_record IN
    SELECT *
    FROM public.omnia_ticket_recurrences
    WHERE is_active = true
      AND next_occurrence_date IS NOT NULL
      AND next_occurrence_date <= p_run_date
    ORDER BY next_occurrence_date, id
    FOR UPDATE SKIP LOCKED
  LOOP
    WHILE recurrence_record.is_active
      AND recurrence_record.next_occurrence_date IS NOT NULL
      AND recurrence_record.next_occurrence_date <= p_run_date
      AND (
        recurrence_record.end_type <> 'ON_DATE'
        OR recurrence_record.next_occurrence_date <= recurrence_record.end_date
      )
      AND (
        recurrence_record.end_type <> 'AFTER_COUNT'
        OR recurrence_record.generated_occurrences < recurrence_record.occurrence_limit
      )
    LOOP
      next_occurrence_number := recurrence_record.generated_occurrences + 1;
      next_due_date := recurrence_record.next_occurrence_date;
      inserted_ticket_id := NULL;

      INSERT INTO public.omnia_tickets (
        title,
        description,
        priority,
        due_date,
        ticket_octa,
        status_id,
        assigned_to,
        created_by,
        oportunidade_id,
        tags,
        is_private,
        recurrence_id,
        recurrence_occurrence
      )
      VALUES (
        recurrence_record.title,
        recurrence_record.description,
        recurrence_record.priority,
        next_due_date,
        recurrence_record.ticket_octa,
        recurrence_record.status_id,
        recurrence_record.assigned_to,
        recurrence_record.created_by,
        recurrence_record.oportunidade_id,
        recurrence_record.tags,
        recurrence_record.is_private,
        recurrence_record.id,
        next_occurrence_number
      )
      ON CONFLICT (recurrence_id, recurrence_occurrence)
      WHERE recurrence_id IS NOT NULL AND recurrence_occurrence IS NOT NULL
      DO NOTHING
      RETURNING id INTO inserted_ticket_id;

      IF inserted_ticket_id IS NOT NULL THEN
        generated_count := generated_count + 1;
      END IF;

      recurrence_record.generated_occurrences := next_occurrence_number;
      recurrence_record.next_occurrence_date := public.add_ticket_recurrence_interval(
        next_due_date,
        recurrence_record.frequency,
        recurrence_record.interval
      );

      IF recurrence_record.end_type = 'ON_DATE'
        AND recurrence_record.next_occurrence_date > recurrence_record.end_date THEN
        recurrence_record.is_active := false;
        recurrence_record.next_occurrence_date := NULL;
      ELSIF recurrence_record.end_type = 'AFTER_COUNT'
        AND recurrence_record.generated_occurrences >= recurrence_record.occurrence_limit THEN
        recurrence_record.is_active := false;
        recurrence_record.next_occurrence_date := NULL;
      END IF;
    END LOOP;

    UPDATE public.omnia_ticket_recurrences
    SET generated_occurrences = recurrence_record.generated_occurrences,
        next_occurrence_date = recurrence_record.next_occurrence_date,
        is_active = recurrence_record.is_active
    WHERE id = recurrence_record.id;
  END LOOP;

  RETURN generated_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_omnia_ticket_recurrences(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_omnia_ticket_recurrences(date) TO service_role;
CREATE OR REPLACE FUNCTION public.omnia_notify_ticket_assigned_to_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_omnia_user_id uuid;
BEGIN
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    IF NEW.assigned_to IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT id
      INTO actor_omnia_user_id
      FROM public.omnia_users
      WHERE auth_user_id = auth.uid();

    IF actor_omnia_user_id IS NOT NULL AND NEW.assigned_to = actor_omnia_user_id THEN
      RETURN NEW;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.omnia_users u
      WHERE u.id = NEW.assigned_to
        AND COALESCE(u.active, true) = true
    ) THEN
      INSERT INTO public.omnia_notifications (user_id, type, ticket_id, created_by)
      VALUES (NEW.assigned_to, 'assigned', NEW.id, actor_omnia_user_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS omnia_notify_ticket_assigned_to_change ON public.omnia_tickets;
CREATE TRIGGER omnia_notify_ticket_assigned_to_change
AFTER UPDATE OF assigned_to ON public.omnia_tickets
FOR EACH ROW
EXECUTE FUNCTION public.omnia_notify_ticket_assigned_to_change();

-- Task comments exactly as the production migrations define them (table, RLS, count trigger, notification FK).
CREATE TABLE public.omnia_ticket_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL,
  body TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  author_id UUID NOT NULL
);
ALTER TABLE public.omnia_ticket_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view ticket comments" ON public.omnia_ticket_comments FOR SELECT USING (auth.role() = 'authenticated'::text);
CREATE POLICY "Authenticated users can create ticket comments" ON public.omnia_ticket_comments FOR INSERT WITH CHECK (auth.role() = 'authenticated'::text);
CREATE POLICY "Users can update their own ticket comments" ON public.omnia_ticket_comments FOR UPDATE USING ((created_by = auth.uid()) OR (EXISTS (SELECT 1 FROM omnia_users WHERE ((omnia_users.auth_user_id = auth.uid()) AND ('ADMIN'::text = ANY (omnia_users.roles))))));
CREATE POLICY "Users can delete their own ticket comments or admins can delete any" ON public.omnia_ticket_comments FOR DELETE USING ((created_by = auth.uid()) OR (EXISTS (SELECT 1 FROM omnia_users WHERE ((omnia_users.auth_user_id = auth.uid()) AND ('ADMIN'::text = ANY (omnia_users.roles))))));
CREATE OR REPLACE FUNCTION public.update_ticket_comment_count_new() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.omnia_tickets SET comment_count = comment_count + 1 WHERE id = NEW.ticket_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.omnia_tickets SET comment_count = comment_count - 1 WHERE id = OLD.ticket_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER update_ticket_comment_count_trigger AFTER INSERT OR DELETE ON public.omnia_ticket_comments FOR EACH ROW EXECUTE FUNCTION public.update_ticket_comment_count_new();
ALTER TABLE public.omnia_notifications ADD CONSTRAINT omnia_notifications_ticket_comment_id_fkey FOREIGN KEY (ticket_comment_id) REFERENCES public.omnia_ticket_comments(id) ON DELETE CASCADE;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
INSERT INTO public.omnia_users(id,auth_user_id,name,email,roles) VALUES
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Alice','alice@example.test',ARRAY['USUARIO']),
('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','Bob','bob@example.test',ARRAY['USUARIO']),
('10000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000003','Admin','admin@example.test',ARRAY['ADMIN']);
INSERT INTO public.omnia_menu_items(id,name,path) VALUES ('30000000-0000-0000-0000-000000000001','Tarefas','/tarefas');
INSERT INTO public.omnia_role_permissions(role_name,menu_item_id,can_access) SELECT r,'30000000-0000-0000-0000-000000000001',true FROM unnest(ARRAY['USUARIO','ADMIN']) r;
INSERT INTO public.omnia_ticket_statuses(id,name,color,order_position,is_default,is_final) VALUES
('40000000-0000-0000-0000-000000000001','Aberta','#000000',1,true,false),
('40000000-0000-0000-0000-000000000002','Concluída','#000000',2,false,true);
