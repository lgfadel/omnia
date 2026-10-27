-- Minimal schema for the real notification migrations; used only in a disposable DB.
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE SCHEMA private;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TABLE public.omnia_users (id uuid PRIMARY KEY, auth_user_id uuid, name text, roles text[] DEFAULT ARRAY['USUARIO'], active boolean DEFAULT true, can_access_tasks boolean DEFAULT true);
CREATE FUNCTION public.check_user_menu_permission(actor uuid,path text) RETURNS boolean LANGUAGE sql AS $$ SELECT can_access_tasks FROM public.omnia_users WHERE id=actor $$;
CREATE TABLE public.omnia_tickets (id uuid PRIMARY KEY, ticket_id integer, title text, assigned_to uuid, created_by uuid, is_private boolean DEFAULT false, status_id integer DEFAULT 1);
CREATE TABLE public.omnia_atas (id uuid PRIMARY KEY, title text, code text, created_by uuid, responsible_id uuid, secretary_id uuid);
CREATE TABLE public.omnia_comments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ata_id uuid REFERENCES public.omnia_atas, author_id uuid, body text);
CREATE TABLE public.omnia_ticket_comments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ticket_id uuid, author_id uuid, body text);
CREATE TABLE public.omnia_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES public.omnia_users, type text NOT NULL,
 ticket_id uuid, ata_id uuid, comment_id uuid REFERENCES public.omnia_comments ON DELETE CASCADE,
 ticket_comment_id uuid REFERENCES public.omnia_ticket_comments ON DELETE CASCADE,
 created_by uuid, created_at timestamptz DEFAULT now(), read_at timestamptz,
 CONSTRAINT notifications_type_check CHECK (type IN ('assigned','mentioned','secretary','responsible'))
);
CREATE UNIQUE INDEX omnia_notifications_dedupe_unread_idx ON public.omnia_notifications
 (type,user_id,coalesce(ticket_id,ata_id,'00000000-0000-0000-0000-000000000000'::uuid),coalesce(comment_id,ticket_comment_id,'00000000-0000-0000-0000-000000000000'::uuid)) WHERE read_at IS NULL AND type='mentioned';
CREATE FUNCTION public.test_assert(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION '%',label; END IF; END $$;
INSERT INTO auth.users VALUES ('20000000-0000-0000-0000-000000000001');
INSERT INTO public.omnia_users(id,auth_user_id,name) VALUES
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Creator'),
 ('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','Responsible'),
 ('10000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000003','Secretary'),
 ('10000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000004','Author'),
 ('10000000-0000-0000-0000-000000000005','20000000-0000-0000-0000-000000000005','Other user');
INSERT INTO public.omnia_tickets(id,ticket_id,title,created_by,assigned_to) VALUES ('30000000-0000-0000-0000-000000000001',413,'Fixture task','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002');
INSERT INTO public.omnia_atas(id,title,created_by,responsible_id,secretary_id) VALUES ('40000000-0000-0000-0000-000000000001','Fixture meeting','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003');
