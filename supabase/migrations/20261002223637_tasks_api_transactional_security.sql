-- Trusted API inputs only. The public entry point is SECURITY INVOKER and service-only;
-- the private definer owns no tables and executes under the same RLS as a human.
CREATE SCHEMA tasks_api_private;
REVOKE ALL ON SCHEMA tasks_api_private FROM PUBLIC, anon, authenticated;
DO $$ BEGIN
  CREATE ROLE omnia_tasks_worker NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER ROLE omnia_tasks_worker NOLOGIN NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='omnia_tasks_worker' AND (rolsuper OR rolbypassrls)) THEN RAISE EXCEPTION 'Unsafe existing omnia_tasks_worker role'; END IF;
END $$;
-- Existing policy expressions resolve auth helper OIDs at policy creation.
-- Do not inherit all authenticated privileges or alter the managed auth schema.
REVOKE authenticated FROM omnia_tasks_worker;
GRANT omnia_tasks_worker TO CURRENT_USER;
GRANT USAGE ON SCHEMA public, tasks_api_private TO omnia_tasks_worker;
GRANT USAGE ON SCHEMA tasks_api_private TO service_role;
GRANT SELECT ON public.omnia_users, public.omnia_ticket_statuses, public.omnia_crm_leads TO omnia_tasks_worker;
GRANT UPDATE(id) ON public.omnia_users TO omnia_tasks_worker;
GRANT SELECT, INSERT, UPDATE ON public.omnia_tickets, public.omnia_ticket_recurrences TO omnia_tasks_worker;
GRANT USAGE ON SEQUENCE public.omnia_tickets_ticket_id_seq TO omnia_tasks_worker;
ALTER FUNCTION public.check_user_menu_permission(uuid,text) SET search_path=public,pg_temp;
ALTER FUNCTION public.is_admin_user(uuid) SET search_path=public,pg_temp;
CREATE OR REPLACE FUNCTION public.is_admin_user(user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM public.omnia_users WHERE auth_user_id=user_id AND coalesce(active,true) AND 'ADMIN'=ANY(roles))
$$;
GRANT EXECUTE ON FUNCTION public.check_user_menu_permission(uuid,text), public.is_admin_user(uuid), public.add_ticket_recurrence_interval(date,public.ticket_recurrence_frequency,integer) TO omnia_tasks_worker;

CREATE TABLE tasks_api_private.credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid NOT NULL REFERENCES public.omnia_users(id),
  auth_user_id uuid NOT NULL, name text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  token_digest text NOT NULL UNIQUE CHECK (token_digest ~ '^[0-9a-f]{64}$'),
  audience text NOT NULL CHECK (audience IN ('api','mcp')),
  scopes text[] NOT NULL CHECK (cardinality(scopes)>0 AND scopes <@ ARRAY['tasks:read','tasks:create','tasks:update']::text[]),
  created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '90 days',
  revoked_at timestamptz, last_used_at timestamptz
);
CREATE TABLE tasks_api_private.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), parent_id uuid NOT NULL REFERENCES tasks_api_private.credentials(id),
  token_digest text NOT NULL UNIQUE CHECK (token_digest ~ '^[0-9a-f]{64}$'),
  audience text NOT NULL DEFAULT 'api' CHECK (audience='api'), scopes text[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
CREATE TABLE tasks_api_private.audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL, actor_id uuid NOT NULL,
  credential_id uuid, operation text NOT NULL, resource_id uuid, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE tasks_api_private.idempotency (
  actor_id uuid NOT NULL, principal text NOT NULL, operation text NOT NULL, key text NOT NULL,
  payload jsonb NOT NULL, response jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(actor_id,principal,operation,key)
);
CREATE TABLE tasks_api_private.rate_limits (
  actor_id uuid NOT NULL, window_start timestamptz NOT NULL, requests integer NOT NULL,
  PRIMARY KEY(actor_id,window_start)
);
CREATE INDEX ON tasks_api_private.sessions(parent_id);
CREATE INDEX ON tasks_api_private.audit(actor_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_api_cursor ON public.omnia_tickets(created_at DESC,id DESC);
DO $$ DECLARE n text; BEGIN
  FOREACH n IN ARRAY ARRAY['credentials','sessions','audit','idempotency','rate_limits'] LOOP
    EXECUTE format('ALTER TABLE tasks_api_private.%I ENABLE ROW LEVEL SECURITY',n);
    EXECUTE format('CREATE POLICY worker_access ON tasks_api_private.%I TO omnia_tasks_worker USING (true) WITH CHECK (true)',n);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA tasks_api_private TO omnia_tasks_worker;

-- Restrictive guards also neutralize any older permissive policy left in a project.
CREATE POLICY tasks_api_live_actor_guard ON public.omnia_tickets AS RESTRICTIVE FOR ALL
USING (auth.role()='authenticated' AND EXISTS (SELECT 1 FROM public.omnia_users u WHERE u.auth_user_id=auth.uid() AND coalesce(u.active,true) AND u.roles && ARRAY['ADMIN','SECRETARIO','USUARIO']::text[] AND public.check_user_menu_permission(u.id,'/tarefas')))
WITH CHECK (auth.role()='authenticated' AND EXISTS (SELECT 1 FROM public.omnia_users u WHERE u.auth_user_id=auth.uid() AND coalesce(u.active,true) AND u.roles && ARRAY['ADMIN','SECRETARIO','USUARIO']::text[] AND public.check_user_menu_permission(u.id,'/tarefas')));
CREATE POLICY tasks_api_privacy_guard ON public.omnia_tickets AS RESTRICTIVE FOR ALL
USING (NOT coalesce(is_private,false) OR created_by=(SELECT id FROM public.omnia_users WHERE auth_user_id=auth.uid()) OR public.is_admin_user(auth.uid()))
WITH CHECK ((NOT coalesce(is_private,false) OR created_by=(SELECT id FROM public.omnia_users WHERE auth_user_id=auth.uid()) OR public.is_admin_user(auth.uid())) AND
 (NOT coalesce(is_private,false) OR assigned_to IS NULL OR assigned_to=created_by OR public.is_admin_user(auth.uid())));
CREATE POLICY tasks_api_creator_guard ON public.omnia_tickets AS RESTRICTIVE FOR INSERT
WITH CHECK (created_by=(SELECT id FROM public.omnia_users WHERE auth_user_id=auth.uid()) OR
 (recurrence_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.omnia_ticket_recurrences r WHERE r.id=recurrence_id AND r.created_by IS NOT DISTINCT FROM omnia_tickets.created_by)));
DROP POLICY IF EXISTS "Authenticated users can create tickets" ON public.omnia_tickets;
DROP POLICY IF EXISTS "Authenticated users can update tickets" ON public.omnia_tickets;
CREATE POLICY "Authenticated users can create tickets" ON public.omnia_tickets FOR INSERT
WITH CHECK (auth.role()='authenticated' AND
  (created_by=(SELECT id FROM public.omnia_users WHERE auth_user_id=auth.uid()) OR
   (recurrence_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.omnia_ticket_recurrences r WHERE r.id=recurrence_id AND r.created_by IS NOT DISTINCT FROM omnia_tickets.created_by))) AND
  (NOT coalesce(is_private,false) OR assigned_to IS NULL OR assigned_to=created_by OR public.is_admin_user(auth.uid())));
CREATE POLICY "Authenticated users can update tickets" ON public.omnia_tickets FOR UPDATE
USING (auth.role()='authenticated') WITH CHECK (NOT coalesce(is_private,false) OR assigned_to IS NULL OR assigned_to=created_by OR public.is_admin_user(auth.uid()));
-- Role-scoped policies may otherwise exclude the non-member definer role.
CREATE POLICY tasks_api_worker_read ON public.omnia_users FOR SELECT TO omnia_tasks_worker USING (auth.role()='authenticated');
CREATE POLICY tasks_api_worker_read ON public.omnia_ticket_statuses FOR SELECT TO omnia_tasks_worker USING (auth.role()='authenticated');
CREATE POLICY tasks_api_worker_access ON public.omnia_tickets FOR ALL TO omnia_tasks_worker USING (auth.role()='authenticated') WITH CHECK (auth.role()='authenticated');
CREATE POLICY tasks_api_worker_access ON public.omnia_ticket_recurrences FOR ALL TO omnia_tasks_worker USING (auth.role()='authenticated') WITH CHECK (auth.role()='authenticated');
CREATE POLICY tasks_api_worker_read ON public.omnia_crm_leads FOR SELECT TO omnia_tasks_worker USING (auth.role()='authenticated');
CREATE POLICY tasks_api_recurrence_guard ON public.omnia_ticket_recurrences AS RESTRICTIVE FOR ALL
USING (auth.role()='authenticated' AND (NOT is_private OR created_by=(SELECT id FROM public.omnia_users WHERE auth_user_id=auth.uid()) OR public.is_admin_user(auth.uid())) AND EXISTS(SELECT 1 FROM public.omnia_users u WHERE u.auth_user_id=auth.uid() AND coalesce(u.active,true) AND public.check_user_menu_permission(u.id,'/tarefas')))
WITH CHECK (auth.role()='authenticated' AND (NOT is_private OR created_by=(SELECT id FROM public.omnia_users WHERE auth_user_id=auth.uid()) OR public.is_admin_user(auth.uid())) AND EXISTS(SELECT 1 FROM public.omnia_users u WHERE u.auth_user_id=auth.uid() AND coalesce(u.active,true) AND public.check_user_menu_permission(u.id,'/tarefas')));

CREATE FUNCTION tasks_api_private.protect_profile_privileges() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF current_user IN ('authenticated','omnia_tasks_worker') AND NOT public.is_admin_user(auth.uid()) THEN
    IF TG_OP='INSERT' THEN
      IF NEW.auth_user_id IS DISTINCT FROM auth.uid() OR NEW.roles IS DISTINCT FROM ARRAY['USUARIO']::text[] OR NEW.active IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'Profile authorization fields are managed by administrators' USING ERRCODE='42501';
      END IF;
    ELSIF NEW.id IS DISTINCT FROM OLD.id OR NEW.roles IS DISTINCT FROM OLD.roles OR NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id OR NEW.active IS DISTINCT FROM OLD.active THEN
      RAISE EXCEPTION 'Profile authorization fields are managed by administrators' USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tasks_api_protect_profile BEFORE INSERT OR UPDATE ON public.omnia_users FOR EACH ROW EXECUTE FUNCTION tasks_api_private.protect_profile_privileges();
REVOKE ALL ON FUNCTION tasks_api_private.protect_profile_privileges() FROM PUBLIC, anon, authenticated;

CREATE FUNCTION tasks_api_private.fail(p_status integer,p_code text,p_message text) RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
BEGIN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE=p_message,DETAIL=jsonb_build_object('status',p_status,'error',jsonb_build_object('code',p_code,'message',p_message))::text; END $$;
CREATE FUNCTION tasks_api_private.keys(p_value jsonb,p_allowed text[]) RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF jsonb_typeof(p_value) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_value) k WHERE NOT k=ANY(p_allowed)) THEN
    PERFORM tasks_api_private.fail(400,'VALIDATION_ERROR','Unexpected or invalid input fields');
  END IF;
END $$;
CREATE FUNCTION tasks_api_private.user_dto(p_user public.omnia_users) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT CASE WHEN p_user.id IS NULL THEN NULL ELSE jsonb_build_object('id',p_user.id,'name',p_user.name,'email',p_user.email,'roles',p_user.roles,'avatarUrl',p_user.avatar_url,'color',p_user.color) END
$$;
CREATE FUNCTION tasks_api_private.task_dto(p_task public.omnia_tickets) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
SELECT jsonb_build_object(
 'id',p_task.id,'ticketId',p_task.ticket_id,'ticketOcta',p_task.ticket_octa,'title',p_task.title,'description',p_task.description,'priority',p_task.priority,'dueDate',p_task.due_date,
 'statusId',p_task.status_id,'assignedToId',p_task.assigned_to,'createdById',p_task.created_by,'tags',coalesce(p_task.tags,'{}'::text[]),'isPrivate',coalesce(p_task.is_private,false),'oportunidadeId',p_task.oportunidade_id,
 'commentCount',coalesce(p_task.comment_count,0),'attachmentCount',p_task.attachment_count,'recurrenceId',p_task.recurrence_id,'recurrenceOccurrence',p_task.recurrence_occurrence,'createdAt',p_task.created_at,'updatedAt',p_task.updated_at,
 'assignedTo',(SELECT tasks_api_private.user_dto(u) FROM public.omnia_users u WHERE u.id=p_task.assigned_to),
 'createdBy',(SELECT tasks_api_private.user_dto(u) FROM public.omnia_users u WHERE u.id=p_task.created_by),
 'recurrence',(SELECT jsonb_build_object('id',r.id,'templateTicketId',r.template_ticket_id,'frequency',r.frequency,'interval',r.interval,'startDate',r.start_date,'endType',r.end_type,'endDate',r.end_date,'occurrenceLimit',r.occurrence_limit,'generatedOccurrences',r.generated_occurrences,'nextOccurrenceDate',r.next_occurrence_date,'isActive',r.is_active) FROM public.omnia_ticket_recurrences r WHERE r.id=p_task.recurrence_id)
)
$$;
CREATE FUNCTION tasks_api_private.credential_dto(p_key tasks_api_private.credentials) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
SELECT jsonb_build_object('id',p_key.id,'name',p_key.name,'audience',p_key.audience,'scopes',p_key.scopes,'createdAt',p_key.created_at,'expiresAt',p_key.expires_at,'revokedAt',p_key.revoked_at,'lastUsedAt',p_key.last_used_at)
$$;

-- Shared, invoker-rights primitive for cron and scoped completion. Row locking and
-- occurrence index deduplicate concurrent cron/API calls and reopened occurrences.
CREATE FUNCTION tasks_api_private.generate_next(p_series_id uuid,p_max_occurrence integer DEFAULT NULL) RETURNS integer LANGUAGE plpgsql SET search_path='' AS $$
DECLARE r public.omnia_ticket_recurrences%ROWTYPE; next_date date; inserted uuid; n integer; BEGIN
 SELECT * INTO r FROM public.omnia_ticket_recurrences WHERE id=p_series_id FOR UPDATE;
 IF NOT FOUND OR NOT r.is_active OR r.next_occurrence_date IS NULL OR (p_max_occurrence IS NOT NULL AND r.generated_occurrences>=p_max_occurrence) THEN RETURN 0; END IF;
 IF (r.end_type='ON_DATE' AND r.next_occurrence_date>r.end_date) OR (r.end_type='AFTER_COUNT' AND r.generated_occurrences>=r.occurrence_limit) THEN
   UPDATE public.omnia_ticket_recurrences SET is_active=false,next_occurrence_date=NULL WHERE id=r.id; RETURN 0;
 END IF;
 n:=r.generated_occurrences+1;
 INSERT INTO public.omnia_tickets(title,description,priority,due_date,ticket_octa,status_id,assigned_to,created_by,oportunidade_id,tags,is_private,recurrence_id,recurrence_occurrence)
 VALUES(r.title,r.description,r.priority,r.next_occurrence_date,r.ticket_octa,r.status_id,r.assigned_to,r.created_by,r.oportunidade_id,r.tags,r.is_private,r.id,n)
 ON CONFLICT(recurrence_id,recurrence_occurrence) WHERE recurrence_id IS NOT NULL AND recurrence_occurrence IS NOT NULL DO NOTHING RETURNING id INTO inserted;
 next_date:=public.add_ticket_recurrence_interval(r.next_occurrence_date,r.frequency,r.interval);
 UPDATE public.omnia_ticket_recurrences SET generated_occurrences=n,
   next_occurrence_date=CASE WHEN (r.end_type='ON_DATE' AND next_date>r.end_date) OR (r.end_type='AFTER_COUNT' AND n>=r.occurrence_limit) THEN NULL ELSE next_date END,
   is_active=NOT ((r.end_type='ON_DATE' AND next_date>r.end_date) OR (r.end_type='AFTER_COUNT' AND n>=r.occurrence_limit)) WHERE id=r.id;
 RETURN CASE WHEN inserted IS NULL THEN 0 ELSE 1 END;
END $$;
-- Keep the scheduled signature; authenticated clients can no longer trigger a global run.
CREATE OR REPLACE FUNCTION public.generate_omnia_ticket_recurrences(p_run_date date DEFAULT current_date) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.omnia_ticket_recurrences%ROWTYPE; total integer:=0; BEGIN
 FOR r IN SELECT * FROM public.omnia_ticket_recurrences WHERE is_active AND next_occurrence_date<=p_run_date ORDER BY next_occurrence_date,id FOR UPDATE SKIP LOCKED LOOP
   WHILE r.is_active AND r.next_occurrence_date<=p_run_date LOOP
     total:=total+tasks_api_private.generate_next(r.id);
     SELECT * INTO r FROM public.omnia_ticket_recurrences WHERE id=r.id;
   END LOOP;
 END LOOP; RETURN total;
END $$;
REVOKE ALL ON FUNCTION public.generate_omnia_ticket_recurrences(date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.generate_omnia_ticket_recurrences(date) TO service_role;

CREATE FUNCTION tasks_api_private.validate_task(p_value jsonb) RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
DECLARE k text; BEGIN
 PERFORM tasks_api_private.keys(p_value,ARRAY['title','description','priority','dueDate','ticketOcta','statusId','assignedToId','tags','isPrivate','oportunidadeId','recurrence']);
 FOREACH k IN ARRAY ARRAY['title','description','priority','dueDate','ticketOcta','statusId','assignedToId','oportunidadeId'] LOOP
   IF p_value ? k AND jsonb_typeof(p_value->k) NOT IN ('string','null') THEN PERFORM tasks_api_private.fail(400,'VALIDATION_ERROR','Invalid text field'); END IF;
 END LOOP;
 IF p_value ? 'title' AND (jsonb_typeof(p_value->'title') IS DISTINCT FROM 'string' OR length(btrim(p_value->>'title')) NOT BETWEEN 1 AND 500) THEN PERFORM tasks_api_private.fail(400,'VALIDATION_ERROR','Title must contain 1 to 500 characters'); END IF;
 IF p_value ? 'priority' AND coalesce(p_value->>'priority','') NOT IN ('URGENTE','ALTA','NORMAL','BAIXA') THEN PERFORM tasks_api_private.fail(400,'VALIDATION_ERROR','Invalid priority'); END IF;
 IF p_value ? 'isPrivate' AND jsonb_typeof(p_value->'isPrivate') IS DISTINCT FROM 'boolean' THEN PERFORM tasks_api_private.fail(400,'VALIDATION_ERROR','Invalid privacy flag'); END IF;
 IF p_value ? 'tags' THEN
   IF jsonb_typeof(p_value->'tags') IS DISTINCT FROM 'array' THEN PERFORM tasks_api_private.fail(400,'VALIDATION_ERROR','Invalid tags'); END IF;
   IF jsonb_array_length(p_value->'tags')>50 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_value->'tags') e WHERE jsonb_typeof(e)<>'string' OR length(e#>>'{}')>100) THEN PERFORM tasks_api_private.fail(400,'VALIDATION_ERROR','Invalid tags'); END IF;
 END IF;
 IF p_value->>'dueDate' IS NOT NULL AND (p_value->>'dueDate' !~ '^\d{4}-\d{2}-\d{2}$' OR to_char((p_value->>'dueDate')::date,'YYYY-MM-DD')<>p_value->>'dueDate') THEN PERFORM tasks_api_private.fail(400,'VALIDATION_ERROR','Invalid due date'); END IF;
 IF p_value ? 'statusId' AND NOT EXISTS(SELECT 1 FROM public.omnia_ticket_statuses WHERE id=(p_value->>'statusId')::uuid) THEN PERFORM tasks_api_private.fail(400,'VALIDATION_ERROR','Unknown status'); END IF;
 IF p_value->>'assignedToId' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.omnia_users WHERE id=(p_value->>'assignedToId')::uuid AND coalesce(active,true) AND roles && ARRAY['ADMIN','SECRETARIO','USUARIO']::text[]) THEN PERFORM tasks_api_private.fail(400,'VALIDATION_ERROR','Unknown or ineligible assignee'); END IF;
 IF p_value->>'oportunidadeId' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.omnia_crm_leads WHERE id=(p_value->>'oportunidadeId')::uuid) THEN PERFORM tasks_api_private.fail(400,'VALIDATION_ERROR','Unknown opportunity'); END IF;
END $$;

CREATE FUNCTION tasks_api_private.set_recurrence(p_task public.omnia_tickets,p_config jsonb,p_patch jsonb DEFAULT '{}') RETURNS uuid LANGUAGE plpgsql SET search_path='' AS $$
DECLARE r public.omnia_ticket_recurrences%ROWTYPE; v_start date; v_end date; limit_count integer; interval_count integer; active_flag boolean; series_id uuid;
 next_date date; next_active boolean; occurrence_idx integer; BEGIN
 PERFORM tasks_api_private.keys(p_config,ARRAY['frequency','interval','startDate','endType','endDate','occurrenceLimit','isActive']);
 IF coalesce(p_config->>'frequency','') NOT IN ('DAILY','WEEKLY','MONTHLY') OR coalesce(p_config->>'endType','NEVER') NOT IN ('NEVER','ON_DATE','AFTER_COUNT') THEN PERFORM tasks_api_private.fail(400,'VALIDATION_ERROR','Invalid recurrence configuration'); END IF;
 IF jsonb_typeof(p_config->'startDate') IS DISTINCT FROM 'string' OR p_config->>'startDate' !~ '^\d{4}-\d{2}-\d{2}$' THEN PERFORM tasks_api_private.fail(400,'VALIDATION_ERROR','Recurrence start date required'); END IF;
 IF p_config ? 'interval' AND jsonb_typeof(p_config->'interval') IS DISTINCT FROM 'number' THEN PERFORM tasks_api_private.fail(400,'VALIDATION_ERROR','Invalid recurrence interval'); END IF;
 IF p_config ? 'occurrenceLimit' AND jsonb_typeof(p_config->'occurrenceLimit') NOT IN ('number','null') THEN PERFORM tasks_api_private.fail(400,'VALIDATION_ERROR','Invalid occurrence limit'); END IF;
 IF p_config ? 'isActive' AND jsonb_typeof(p_config->'isActive') IS DISTINCT FROM 'boolean' THEN PERFORM tasks_api_private.fail(400,'VALIDATION_ERROR','Invalid recurrence active flag'); END IF;
 v_start:=(p_config->>'startDate')::date; v_end:=(p_config->>'endDate')::date;
 interval_count:=coalesce((p_config->>'interval')::integer,1); limit_count:=(p_config->>'occurrenceLimit')::integer; active_flag:=coalesce((p_config->>'isActive')::boolean,true);
 IF interval_count NOT BETWEEN 1 AND 365 OR (p_config->>'endType'='ON_DATE' AND (v_end IS NULL OR v_end<v_start)) OR (p_config->>'endType'='AFTER_COUNT' AND (limit_count IS NULL OR limit_count<1)) THEN PERFORM tasks_api_private.fail(400,'VALIDATION_ERROR','Invalid recurrence bounds'); END IF;
 IF p_task.recurrence_id IS NOT NULL THEN
   SELECT * INTO r FROM public.omnia_ticket_recurrences WHERE id=p_task.recurrence_id FOR UPDATE;
   IF NOT FOUND THEN PERFORM tasks_api_private.fail(404,'NOT_FOUND','Recurrence not found'); END IF;
   series_id:=r.id;
   next_active:=active_flag AND NOT (coalesce(p_config->>'endType','NEVER')='AFTER_COUNT' AND r.generated_occurrences>=limit_count);
   -- The persisted pending date is authoritative, even after cadence/start
   -- changes. The new cadence applies after that pending occurrence. Individual
   -- ticket deadlines never participate in series scheduling.
   next_date:=r.next_occurrence_date;
   IF next_active AND next_date IS NULL THEN
     -- Reactivating a paused/exhausted series has no pending cursor. Rebuild its
     -- next nominal slot from series configuration and the persisted count.
     -- Iterate months to preserve Jan 31 -> Feb 28 -> Mar 28 clamp semantics.
     next_date:=v_start;
     FOR occurrence_idx IN 1..r.generated_occurrences LOOP
       next_date:=public.add_ticket_recurrence_interval(next_date,(p_config->>'frequency')::public.ticket_recurrence_frequency,interval_count);
     END LOOP;
   END IF;
   IF coalesce(p_config->>'endType','NEVER')='ON_DATE' AND next_date>v_end THEN next_active:=false; END IF;
   UPDATE public.omnia_ticket_recurrences SET frequency=(p_config->>'frequency')::public.ticket_recurrence_frequency,interval=interval_count,start_date=v_start,
    end_type=coalesce(p_config->>'endType','NEVER')::public.ticket_recurrence_end_type,end_date=v_end,occurrence_limit=limit_count,
    is_active=next_active,next_occurrence_date=CASE WHEN next_active THEN next_date ELSE NULL END,
    -- Occurrence edits are independent. Only fields explicitly submitted with
    -- this recurrence edit may change the future template, including null clears.
    title=CASE WHEN p_patch ? 'title' THEN p_task.title ELSE r.title END,
    description=CASE WHEN p_patch ? 'description' THEN p_task.description ELSE r.description END,
    priority=CASE WHEN p_patch ? 'priority' THEN p_task.priority ELSE r.priority END,
    -- Completing this occurrence must not make future occurrences final.
    status_id=CASE WHEN p_patch ? 'statusId' AND NOT coalesce((SELECT is_final FROM public.omnia_ticket_statuses WHERE id=p_task.status_id),false) THEN p_task.status_id ELSE r.status_id END,
    assigned_to=CASE WHEN p_patch ? 'assignedToId' THEN p_task.assigned_to ELSE r.assigned_to END,
    oportunidade_id=CASE WHEN p_patch ? 'oportunidadeId' THEN p_task.oportunidade_id ELSE r.oportunidade_id END,
    tags=CASE WHEN p_patch ? 'tags' THEN coalesce(p_task.tags,'{}') ELSE r.tags END,
    is_private=CASE WHEN p_patch ? 'isPrivate' THEN coalesce(p_task.is_private,false) ELSE r.is_private END,
    ticket_octa=CASE WHEN p_patch ? 'ticketOcta' THEN p_task.ticket_octa ELSE r.ticket_octa END WHERE id=r.id;
 ELSE
   INSERT INTO public.omnia_ticket_recurrences(template_ticket_id,frequency,interval,start_date,end_type,end_date,occurrence_limit,generated_occurrences,next_occurrence_date,is_active,title,description,priority,status_id,assigned_to,created_by,oportunidade_id,tags,is_private,ticket_octa)
   VALUES(p_task.id,(p_config->>'frequency')::public.ticket_recurrence_frequency,interval_count,v_start,coalesce(p_config->>'endType','NEVER')::public.ticket_recurrence_end_type,v_end,limit_count,1,
    CASE WHEN active_flag AND NOT (coalesce(p_config->>'endType','NEVER')='AFTER_COUNT' AND limit_count=1) THEN public.add_ticket_recurrence_interval(v_start,(p_config->>'frequency')::public.ticket_recurrence_frequency,interval_count) END,
    active_flag AND NOT (coalesce(p_config->>'endType','NEVER')='AFTER_COUNT' AND limit_count=1),p_task.title,p_task.description,p_task.priority,p_task.status_id,p_task.assigned_to,p_task.created_by,p_task.oportunidade_id,coalesce(p_task.tags,'{}'),coalesce(p_task.is_private,false),p_task.ticket_octa) RETURNING id INTO series_id;
 END IF;
 RETURN series_id;
END $$;

CREATE FUNCTION tasks_api_private.dispatch(
 p_operation text,p_payload jsonb,p_auth_user_id uuid,p_token_digest text,p_idempotency_key text,p_request_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 old_sub text:=current_setting('request.jwt.claim.sub',true); old_role text:=current_setting('request.jwt.claim.role',true); old_claims text:=current_setting('request.jwt.claims',true);
 verified_auth uuid; actor public.omnia_users%ROWTYPE; cred tasks_api_private.credentials%ROWTYPE; session_record tasks_api_private.sessions%ROWTYPE;
 v_task public.omnia_tickets%ROWTYPE; before_task public.omnia_tickets%ROWTYPE; v_patch jsonb; result jsonb; response jsonb; cached tasks_api_private.idempotency%ROWTYPE;
 scope text; v_principal text; rate_count integer; page_limit integer; new_series uuid; err_detail text; err_state text; err_message text; key_id uuid;
BEGIN
 BEGIN
  IF p_operation IS NULL OR p_operation NOT IN ('tasks.list','tasks.get','tasks.create','tasks.update','statuses.list','assignees.list','credentials.list','credentials.create','credentials.revoke','mcp.exchange') THEN PERFORM tasks_api_private.fail(400,'INVALID_OPERATION','Unknown operation'); END IF;
  IF (p_auth_user_id IS NULL)=(p_token_digest IS NULL) THEN PERFORM tasks_api_private.fail(401,'INVALID_AUTH','Exactly one verified identity is required'); END IF;
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN PERFORM tasks_api_private.fail(400,'VALIDATION_ERROR','Payload must be an object'); END IF;
  IF p_token_digest IS NOT NULL THEN
    IF p_token_digest !~ '^[0-9a-f]{64}$' THEN PERFORM tasks_api_private.fail(401,'INVALID_CREDENTIAL','Invalid credential'); END IF;
    SELECT * INTO cred FROM tasks_api_private.credentials WHERE token_digest=p_token_digest FOR UPDATE;
    IF NOT FOUND THEN
      SELECT * INTO session_record FROM tasks_api_private.sessions WHERE token_digest=p_token_digest FOR SHARE;
      IF NOT FOUND OR session_record.revoked_at IS NOT NULL OR session_record.expires_at<=clock_timestamp() THEN PERFORM tasks_api_private.fail(401,'INVALID_CREDENTIAL','Invalid or expired credential'); END IF;
      SELECT * INTO cred FROM tasks_api_private.credentials WHERE id=session_record.parent_id FOR UPDATE;
    END IF;
    IF cred.id IS NULL OR cred.revoked_at IS NOT NULL OR cred.expires_at<=clock_timestamp() THEN PERFORM tasks_api_private.fail(401,'INVALID_CREDENTIAL','Invalid or expired credential'); END IF;
    IF p_operation LIKE 'credentials.%' THEN PERFORM tasks_api_private.fail(403,'FORBIDDEN','Credential management requires a verified browser user'); END IF;
    IF (p_operation='mcp.exchange' AND (cred.audience<>'mcp' OR session_record.id IS NOT NULL)) OR (p_operation<>'mcp.exchange' AND session_record.id IS NULL AND cred.audience<>'api') THEN PERFORM tasks_api_private.fail(403,'INVALID_AUDIENCE','Credential audience does not match the resource'); END IF;
    verified_auth:=cred.auth_user_id; v_principal:='credential:'||cred.id::text; key_id:=cred.id;
  ELSE
    IF p_operation='mcp.exchange' THEN PERFORM tasks_api_private.fail(403,'INVALID_AUDIENCE','MCP credential required'); END IF;
    verified_auth:=p_auth_user_id; v_principal:='browser:'||verified_auth::text;
  END IF;
  -- Set both generations of claims: this database's auth.uid/auth.role prefer legacy GUCs.
  PERFORM set_config('request.jwt.claim.sub',verified_auth::text,true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',verified_auth,'role','authenticated')::text,true);
  SELECT * INTO actor FROM public.omnia_users WHERE auth_user_id=verified_auth FOR SHARE;
  IF actor.id IS NULL OR NOT coalesce(actor.active,true) OR (cred.id IS NOT NULL AND cred.actor_id<>actor.id) THEN PERFORM tasks_api_private.fail(403,'ACTOR_DISABLED','User is missing, disabled or no longer linked to this credential'); END IF;
  IF p_operation NOT LIKE 'credentials.%' THEN
    IF NOT coalesce(public.check_user_menu_permission(actor.id,'/tarefas'),false) OR NOT coalesce(actor.roles && ARRAY['ADMIN','SECRETARIO','USUARIO']::text[],false) THEN PERFORM tasks_api_private.fail(403,'FORBIDDEN','Task access is denied'); END IF;
    scope:=CASE p_operation WHEN 'tasks.create' THEN 'tasks:create' WHEN 'tasks.update' THEN 'tasks:update' ELSE 'tasks:read' END;
    IF cred.id IS NOT NULL AND p_operation<>'mcp.exchange' AND (NOT scope=ANY(cred.scopes) OR (session_record.id IS NOT NULL AND NOT scope=ANY(session_record.scopes))) THEN PERFORM tasks_api_private.fail(403,'INSUFFICIENT_SCOPE','Required task scope is missing'); END IF;
    INSERT INTO tasks_api_private.rate_limits(actor_id,window_start,requests) VALUES(actor.id,date_trunc('minute',clock_timestamp()),1)
    ON CONFLICT(actor_id,window_start) DO UPDATE SET requests=tasks_api_private.rate_limits.requests+1 RETURNING requests INTO rate_count;
    IF rate_count>120 THEN PERFORM tasks_api_private.fail(429,'RATE_LIMITED','Task request rate exceeded'); END IF;
  END IF;
  IF p_operation IN ('tasks.create','tasks.update') THEN
    IF p_idempotency_key IS NULL OR length(p_idempotency_key) NOT BETWEEN 1 AND 200 THEN PERFORM tasks_api_private.fail(400,'VALIDATION_ERROR','A write idempotency key is required'); END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(actor.id::text||v_principal||p_operation||p_idempotency_key,0));
    SELECT * INTO cached FROM tasks_api_private.idempotency WHERE actor_id=actor.id AND tasks_api_private.idempotency.principal=v_principal AND operation=p_operation AND key=p_idempotency_key;
    IF FOUND THEN
      IF cached.payload<>p_payload THEN PERFORM tasks_api_private.fail(409,'IDEMPOTENCY_CONFLICT','Idempotency key was used with different input'); END IF;
      IF NOT EXISTS(SELECT 1 FROM public.omnia_tickets WHERE id=(cached.response#>>'{data,id}')::uuid) THEN PERFORM tasks_api_private.fail(404,'NOT_FOUND','Task not found'); END IF;
      response:=cached.response;
    END IF;
  END IF;
  IF response IS NULL THEN
   CASE p_operation
   WHEN 'credentials.list' THEN
    PERFORM tasks_api_private.keys(p_payload,'{}');
    SELECT coalesce(jsonb_agg(tasks_api_private.credential_dto(c) ORDER BY c.created_at DESC,c.id),'[]'::jsonb) INTO result FROM tasks_api_private.credentials c WHERE c.actor_id=actor.id;
   WHEN 'credentials.create' THEN
    PERFORM tasks_api_private.keys(p_payload,ARRAY['name','audience','scopes','tokenDigest','expiresAt']);
    IF jsonb_typeof(p_payload->'name') IS DISTINCT FROM 'string' OR length(btrim(p_payload->>'name')) NOT BETWEEN 1 AND 100 OR coalesce(p_payload->>'audience','') NOT IN ('api','mcp') OR coalesce(p_payload->>'tokenDigest','') !~ '^[0-9a-f]{64}$' THEN PERFORM tasks_api_private.fail(400,'VALIDATION_ERROR','Invalid credential metadata'); END IF;
    IF jsonb_typeof(p_payload->'scopes') IS DISTINCT FROM 'array' THEN PERFORM tasks_api_private.fail(400,'VALIDATION_ERROR','Credential scopes are required'); END IF;
    IF jsonb_array_length(p_payload->'scopes') NOT BETWEEN 1 AND 3 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'scopes') e WHERE jsonb_typeof(e)<>'string' OR e#>>'{}' NOT IN ('tasks:read','tasks:create','tasks:update')) THEN PERFORM tasks_api_private.fail(400,'VALIDATION_ERROR','Invalid scopes'); END IF;
    IF p_payload->>'expiresAt' IS NOT NULL AND ((p_payload->>'expiresAt')::timestamptz<=clock_timestamp() OR (p_payload->>'expiresAt')::timestamptz>clock_timestamp()+interval '365 days') THEN PERFORM tasks_api_private.fail(400,'VALIDATION_ERROR','Invalid credential expiration'); END IF;
    IF EXISTS(SELECT 1 FROM tasks_api_private.sessions WHERE token_digest=p_payload->>'tokenDigest') THEN PERFORM tasks_api_private.fail(409,'CONFLICT','Digest already exists'); END IF;
    INSERT INTO tasks_api_private.credentials(actor_id,auth_user_id,name,audience,scopes,token_digest,expires_at)
    VALUES(actor.id,verified_auth,btrim(p_payload->>'name'),p_payload->>'audience',ARRAY(SELECT DISTINCT jsonb_array_elements_text(p_payload->'scopes')),p_payload->>'tokenDigest',coalesce((p_payload->>'expiresAt')::timestamptz,clock_timestamp()+interval '90 days')) RETURNING * INTO cred;
    result:=tasks_api_private.credential_dto(cred);
   WHEN 'credentials.revoke' THEN
    PERFORM tasks_api_private.keys(p_payload,ARRAY['id']);
    UPDATE tasks_api_private.credentials SET revoked_at=coalesce(revoked_at,clock_timestamp()) WHERE id=(p_payload->>'id')::uuid AND actor_id=actor.id RETURNING * INTO cred;
    IF NOT FOUND THEN PERFORM tasks_api_private.fail(404,'NOT_FOUND','Credential not found'); END IF;
    result:=tasks_api_private.credential_dto(cred);
   WHEN 'mcp.exchange' THEN
    PERFORM tasks_api_private.keys(p_payload,ARRAY['sessionDigest']);
    IF coalesce(p_payload->>'sessionDigest','') !~ '^[0-9a-f]{64}$' THEN PERFORM tasks_api_private.fail(400,'VALIDATION_ERROR','Invalid session digest'); END IF;
    IF EXISTS(SELECT 1 FROM tasks_api_private.credentials WHERE token_digest=p_payload->>'sessionDigest') THEN PERFORM tasks_api_private.fail(409,'CONFLICT','Digest already exists'); END IF;
    INSERT INTO tasks_api_private.sessions(parent_id,token_digest,scopes,expires_at) VALUES(cred.id,p_payload->>'sessionDigest',cred.scopes,least(cred.expires_at,clock_timestamp()+interval '15 minutes')) RETURNING * INTO session_record;
    result:=jsonb_build_object('id',session_record.id,'audience','api','scopes',session_record.scopes,'expiresAt',session_record.expires_at);
   WHEN 'statuses.list' THEN
    PERFORM tasks_api_private.keys(p_payload,'{}');
    SELECT coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'color',s.color,'order',s.order_position,'isDefault',s.is_default,'isFinal',s.is_final) ORDER BY s.order_position,s.id),'[]'::jsonb) INTO result FROM public.omnia_ticket_statuses s;
   WHEN 'assignees.list' THEN
    PERFORM tasks_api_private.keys(p_payload,ARRAY['query','limit']);
    page_limit:=coalesce((p_payload->>'limit')::integer,50);
    IF page_limit NOT BETWEEN 1 AND 100 THEN PERFORM tasks_api_private.fail(400,'VALIDATION_ERROR','Limit must be 1 to 100'); END IF;
    SELECT coalesce(jsonb_agg(tasks_api_private.user_dto(u.user_record) ORDER BY u.name,u.id),'[]'::jsonb) INTO result FROM (SELECT users AS user_record,users.name,users.id FROM public.omnia_users users WHERE coalesce(active,true) AND roles && ARRAY['ADMIN','SECRETARIO','USUARIO']::text[] AND (p_payload->>'query' IS NULL OR name ILIKE '%'||(p_payload->>'query')||'%' OR email ILIKE '%'||(p_payload->>'query')||'%') ORDER BY name,id LIMIT page_limit) u;
   WHEN 'tasks.list' THEN
    PERFORM tasks_api_private.keys(p_payload,ARRAY['limit','cursor','query','statusId','assignedToId','mine','priority','isPrivate','oportunidadeId','tags','dueDateFrom','dueDateTo']);
    page_limit:=coalesce((p_payload->>'limit')::integer,50);
    IF page_limit NOT BETWEEN 1 AND 100 THEN PERFORM tasks_api_private.fail(400,'VALIDATION_ERROR','Limit must be 1 to 100'); END IF;
    IF p_payload ? 'cursor' AND p_payload->'cursor'<>'null'::jsonb THEN
      PERFORM tasks_api_private.keys(p_payload->'cursor',ARRAY['createdAt','id']);
      IF p_payload#>>'{cursor,createdAt}' IS NULL OR p_payload#>>'{cursor,id}' IS NULL THEN PERFORM tasks_api_private.fail(400,'VALIDATION_ERROR','Invalid cursor'); END IF;
    END IF;
    IF p_payload ? 'tags' AND jsonb_typeof(p_payload->'tags') IS DISTINCT FROM 'array' THEN PERFORM tasks_api_private.fail(400,'VALIDATION_ERROR','Invalid tags'); END IF;
    WITH rows AS (
      SELECT t.* FROM public.omnia_tickets t WHERE
       (p_payload->>'query' IS NULL OR t.title ILIKE '%'||(p_payload->>'query')||'%' OR t.description ILIKE '%'||(p_payload->>'query')||'%' OR t.ticket_octa ILIKE '%'||(p_payload->>'query')||'%' OR t.ticket_id::text=p_payload->>'query') AND
       (p_payload->>'statusId' IS NULL OR t.status_id=(p_payload->>'statusId')::uuid) AND
       (p_payload->>'assignedToId' IS NULL OR t.assigned_to=(p_payload->>'assignedToId')::uuid) AND
       (NOT coalesce((p_payload->>'mine')::boolean,false) OR t.assigned_to=actor.id) AND
       (p_payload->>'priority' IS NULL OR t.priority=(p_payload->>'priority')::public.ticket_priority) AND
       (p_payload->>'isPrivate' IS NULL OR coalesce(t.is_private,false)=(p_payload->>'isPrivate')::boolean) AND
       (p_payload->>'oportunidadeId' IS NULL OR t.oportunidade_id=(p_payload->>'oportunidadeId')::uuid) AND
       (p_payload->>'dueDateFrom' IS NULL OR t.due_date>=(p_payload->>'dueDateFrom')::date) AND
       (p_payload->>'dueDateTo' IS NULL OR t.due_date<=(p_payload->>'dueDateTo')::date) AND
       (NOT p_payload ? 'tags' OR t.tags @> ARRAY(SELECT jsonb_array_elements_text(p_payload->'tags'))) AND
       (p_payload#>>'{cursor,id}' IS NULL OR (t.created_at,t.id)<((p_payload#>>'{cursor,createdAt}')::timestamptz,(p_payload#>>'{cursor,id}')::uuid))
      ORDER BY t.created_at DESC,t.id DESC LIMIT page_limit+1
    ), numbered AS (SELECT r.*,row_number() OVER(ORDER BY r.created_at DESC,r.id DESC) n FROM rows r)
    SELECT jsonb_build_object('items',coalesce(jsonb_agg(tasks_api_private.task_dto(t) ORDER BY n) FILTER(WHERE n<=page_limit),'[]'::jsonb),
       'nextCursor',CASE WHEN count(*)>page_limit THEN (jsonb_agg(jsonb_build_object('createdAt',created_at,'id',id)) FILTER(WHERE n=page_limit))->0 ELSE NULL END)
      INTO result FROM numbered x CROSS JOIN LATERAL (SELECT t FROM public.omnia_tickets t WHERE t.id=x.id) q(t);
   WHEN 'tasks.get' THEN
    PERFORM tasks_api_private.keys(p_payload,ARRAY['id']);
    SELECT * INTO v_task FROM public.omnia_tickets WHERE id=(p_payload->>'id')::uuid;
    IF NOT FOUND THEN PERFORM tasks_api_private.fail(404,'NOT_FOUND','Task not found'); END IF;
    result:=tasks_api_private.task_dto(v_task);
   WHEN 'tasks.create' THEN
    PERFORM tasks_api_private.validate_task(p_payload);
    IF NOT p_payload ? 'title' THEN PERFORM tasks_api_private.fail(400,'VALIDATION_ERROR','Title is required'); END IF;
    IF p_payload ? 'recurrence' AND cred.id IS NOT NULL THEN PERFORM tasks_api_private.fail(403,'FORBIDDEN','Integration keys cannot configure recurrence'); END IF;
    INSERT INTO public.omnia_tickets(title,description,priority,due_date,ticket_octa,status_id,assigned_to,created_by,tags,is_private,oportunidade_id)
    VALUES(btrim(p_payload->>'title'),p_payload->>'description',coalesce(p_payload->>'priority','NORMAL')::public.ticket_priority,(p_payload->>'dueDate')::date,p_payload->>'ticketOcta',coalesce((p_payload->>'statusId')::uuid,(SELECT id FROM public.omnia_ticket_statuses ORDER BY coalesce(is_default,false) DESC,order_position,id LIMIT 1)),(p_payload->>'assignedToId')::uuid,actor.id,
    CASE WHEN p_payload ? 'tags' THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'tags')) ELSE '{}'::text[] END,coalesce((p_payload->>'isPrivate')::boolean,false),(p_payload->>'oportunidadeId')::uuid) RETURNING * INTO v_task;
    IF p_payload ? 'recurrence' AND p_payload->'recurrence'<>'null'::jsonb THEN
      new_series:=tasks_api_private.set_recurrence(v_task,p_payload->'recurrence');
      UPDATE public.omnia_tickets SET recurrence_id=new_series,recurrence_occurrence=1,due_date=coalesce(v_task.due_date,(p_payload#>>'{recurrence,startDate}')::date) WHERE id=v_task.id RETURNING * INTO v_task;
    END IF;
    result:=tasks_api_private.task_dto(v_task);
   WHEN 'tasks.update' THEN
    PERFORM tasks_api_private.keys(p_payload,ARRAY['id','expectedUpdatedAt','patch']);
    IF p_payload->>'expectedUpdatedAt' IS NULL THEN PERFORM tasks_api_private.fail(428,'PRECONDITION_REQUIRED','Expected updated timestamp is required'); END IF;
    v_patch:=p_payload->'patch'; PERFORM tasks_api_private.validate_task(v_patch);
    IF v_patch='{}'::jsonb THEN PERFORM tasks_api_private.fail(400,'VALIDATION_ERROR','Patch must contain a field'); END IF;
    IF v_patch ? 'recurrence' AND cred.id IS NOT NULL THEN PERFORM tasks_api_private.fail(403,'FORBIDDEN','Integration keys cannot configure recurrence'); END IF;
    SELECT * INTO before_task FROM public.omnia_tickets WHERE id=(p_payload->>'id')::uuid FOR UPDATE;
    IF NOT FOUND THEN PERFORM tasks_api_private.fail(404,'NOT_FOUND','Task not found'); END IF;
    IF before_task.updated_at<>(p_payload->>'expectedUpdatedAt')::timestamptz THEN PERFORM tasks_api_private.fail(412,'PRECONDITION_FAILED','Task changed since it was read'); END IF;
    UPDATE public.omnia_tickets SET
      title=CASE WHEN v_patch ? 'title' THEN btrim(v_patch->>'title') ELSE title END,
      description=CASE WHEN v_patch ? 'description' THEN v_patch->>'description' ELSE description END,
      priority=CASE WHEN v_patch ? 'priority' THEN (v_patch->>'priority')::public.ticket_priority ELSE priority END,
      due_date=CASE WHEN v_patch ? 'dueDate' THEN (v_patch->>'dueDate')::date ELSE due_date END,
      ticket_octa=CASE WHEN v_patch ? 'ticketOcta' THEN v_patch->>'ticketOcta' ELSE ticket_octa END,
      status_id=CASE WHEN v_patch ? 'statusId' THEN (v_patch->>'statusId')::uuid ELSE status_id END,
      assigned_to=CASE WHEN v_patch ? 'assignedToId' THEN (v_patch->>'assignedToId')::uuid ELSE assigned_to END,
      tags=CASE WHEN v_patch ? 'tags' THEN ARRAY(SELECT jsonb_array_elements_text(v_patch->'tags')) ELSE tags END,
      is_private=CASE WHEN v_patch ? 'isPrivate' THEN (v_patch->>'isPrivate')::boolean ELSE is_private END,
      oportunidade_id=CASE WHEN v_patch ? 'oportunidadeId' THEN (v_patch->>'oportunidadeId')::uuid ELSE oportunidade_id END
    WHERE id=before_task.id RETURNING * INTO v_task;
    IF NOT FOUND THEN PERFORM tasks_api_private.fail(404,'NOT_FOUND','Task not found'); END IF;
    IF v_patch ? 'recurrence' THEN
      IF v_patch->'recurrence'='null'::jsonb THEN
        IF v_task.recurrence_id IS NOT NULL THEN UPDATE public.omnia_ticket_recurrences SET is_active=false,next_occurrence_date=NULL WHERE id=v_task.recurrence_id; END IF;
      ELSE
        new_series:=tasks_api_private.set_recurrence(v_task,v_patch->'recurrence',v_patch);
        IF v_task.recurrence_id IS NULL THEN UPDATE public.omnia_tickets SET recurrence_id=new_series,recurrence_occurrence=1 WHERE id=v_task.id RETURNING * INTO v_task; END IF;
      END IF;
    END IF;
    IF v_task.recurrence_id IS NOT NULL AND v_task.status_id<>before_task.status_id AND (SELECT is_final FROM public.omnia_ticket_statuses WHERE id=v_task.status_id) AND NOT (SELECT is_final FROM public.omnia_ticket_statuses WHERE id=before_task.status_id) THEN
      PERFORM tasks_api_private.generate_next(v_task.recurrence_id,v_task.recurrence_occurrence+1);
    END IF;
    result:=tasks_api_private.task_dto(v_task);
   END CASE;
   response:=jsonb_build_object('status',CASE WHEN p_operation IN ('tasks.create','credentials.create','mcp.exchange') THEN 201 ELSE 200 END,'data',result);
   IF p_operation IN ('tasks.create','tasks.update') THEN
     INSERT INTO tasks_api_private.idempotency(actor_id,principal,operation,key,payload,response) VALUES(actor.id,v_principal,p_operation,p_idempotency_key,p_payload,response);
   END IF;
   IF p_operation IN ('tasks.create','tasks.update','credentials.create','credentials.revoke','mcp.exchange') THEN
     INSERT INTO tasks_api_private.audit(request_id,actor_id,credential_id,operation,resource_id) VALUES(coalesce(p_request_id,gen_random_uuid()),actor.id,key_id,p_operation,(result->>'id')::uuid);
   END IF;
  END IF;
  IF p_token_digest IS NOT NULL THEN UPDATE tasks_api_private.credentials SET last_used_at=clock_timestamp() WHERE id=cred.id; END IF;
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS err_detail=PG_EXCEPTION_DETAIL,err_state=RETURNED_SQLSTATE,err_message=MESSAGE_TEXT;
  IF err_state='P0001' AND err_detail LIKE '{%' THEN response:=err_detail::jsonb;
  ELSIF err_state IN ('22P02','22007','22008','22003','23502','23503','23514') THEN response:=jsonb_build_object('status',400,'error',jsonb_build_object('code','VALIDATION_ERROR','message','Invalid input or reference'));
  ELSIF err_state='23505' THEN response:=jsonb_build_object('status',409,'error',jsonb_build_object('code','CONFLICT','message','Resource already exists'));
  ELSIF err_state='42501' THEN response:=jsonb_build_object('status',403,'error',jsonb_build_object('code','FORBIDDEN','message','Operation is denied'));
  ELSE RAISE; END IF;
 END;
 PERFORM set_config('request.jwt.claim.sub',coalesce(old_sub,''),true);
 PERFORM set_config('request.jwt.claim.role',coalesce(old_role,''),true);
 PERFORM set_config('request.jwt.claims',coalesce(old_claims,''),true);
 RETURN response;
END $$;

-- Function ownership is changed only after their dependent objects exist.
GRANT CREATE ON SCHEMA tasks_api_private TO omnia_tasks_worker;
ALTER FUNCTION tasks_api_private.dispatch(text,jsonb,uuid,text,text,uuid) OWNER TO omnia_tasks_worker;
REVOKE CREATE ON SCHEMA tasks_api_private FROM omnia_tasks_worker;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA tasks_api_private FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tasks_api_private TO omnia_tasks_worker;
GRANT EXECUTE ON FUNCTION tasks_api_private.dispatch(text,jsonb,uuid,text,text,uuid) TO service_role;
CREATE FUNCTION public.tasks_api_dispatch(p_operation text,p_payload jsonb DEFAULT '{}',p_auth_user_id uuid DEFAULT NULL,p_token_digest text DEFAULT NULL,p_idempotency_key text DEFAULT NULL,p_request_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT tasks_api_private.dispatch(p_operation,p_payload,p_auth_user_id,p_token_digest,p_idempotency_key,p_request_id) $$;
REVOKE ALL ON FUNCTION public.tasks_api_dispatch(text,jsonb,uuid,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tasks_api_dispatch(text,jsonb,uuid,text,text,uuid) TO service_role;
