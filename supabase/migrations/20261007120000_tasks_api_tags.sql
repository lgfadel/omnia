-- Task tags for the official API and MCP gateway: read-only catalog (omnia_tags) behind the same
-- hardened dispatch boundary (verified identity, tasks:read scope, kill switch, rate limit).
-- Tasks reference tags by name (omnia_tickets.tags text[]); this exposes the names that exist.
-- Integration credentials (API keys and the MCP) may only use tags that exist in the catalog; the
-- browser keeps creating tags on the fly through the interface.

-- 1. The worker reads the catalog under RLS like a human; no write access is granted.
GRANT SELECT ON public.omnia_tags TO omnia_tasks_worker;
CREATE POLICY tasks_api_worker_read ON public.omnia_tags FOR SELECT TO omnia_tasks_worker USING (auth.role()='authenticated');

-- 2. Integration writes may only use catalogued tags. On update, tags the task already carries stay
-- allowed so an old task with a retired tag can still be edited; only new names must exist.
CREATE FUNCTION tasks_api_private.assert_known_tags(p_tags jsonb,p_current text[]) RETURNS void LANGUAGE plpgsql STABLE SET search_path='' AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_tags) t WHERE NOT t=ANY(coalesce(p_current,'{}'::text[])) AND NOT EXISTS(SELECT 1 FROM public.omnia_tags g WHERE g.name=t)) THEN
    PERFORM tasks_api_private.fail(400,'UNKNOWN_TAG','Tag is not in the catalog');
  END IF;
END $$;
REVOKE ALL ON FUNCTION tasks_api_private.assert_known_tags(jsonb,text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION tasks_api_private.assert_known_tags(jsonb,text[]) TO omnia_tasks_worker;

-- 3. Same body as before plus tags.list and the catalog check; owner (omnia_tasks_worker) and grants are preserved by OR REPLACE.
CREATE OR REPLACE FUNCTION tasks_api_private.dispatch(
 p_operation text,p_payload jsonb,p_auth_user_id uuid,p_token_digest text,p_idempotency_key text,p_request_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 old_sub text:=current_setting('request.jwt.claim.sub',true); old_role text:=current_setting('request.jwt.claim.role',true); old_claims text:=current_setting('request.jwt.claims',true);
 verified_auth uuid; actor public.omnia_users%ROWTYPE; cred tasks_api_private.credentials%ROWTYPE; session_record tasks_api_private.sessions%ROWTYPE;
 v_task public.omnia_tickets%ROWTYPE; before_task public.omnia_tickets%ROWTYPE; v_comment public.omnia_ticket_comments%ROWTYPE; v_patch jsonb; result jsonb; response jsonb; cached tasks_api_private.idempotency%ROWTYPE;
 scope text; v_principal text; rate_count integer; page_limit integer; new_series uuid; err_detail text; err_state text; err_message text; key_id uuid;
BEGIN
 BEGIN
  IF p_operation IS NULL OR p_operation NOT IN ('tasks.list','tasks.get','tasks.create','tasks.update','comments.list','comments.create','comments.update','comments.delete','statuses.list','tags.list','assignees.list','credentials.list','credentials.create','credentials.revoke','mcp.exchange') THEN PERFORM tasks_api_private.fail(400,'INVALID_OPERATION','Unknown operation'); END IF;
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
    IF cred.id IS NULL OR cred.revoked_at IS NOT NULL OR (cred.expires_at IS NOT NULL AND cred.expires_at<=clock_timestamp()) THEN PERFORM tasks_api_private.fail(401,'INVALID_CREDENTIAL','Invalid or expired credential'); END IF;
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
    scope:=CASE p_operation WHEN 'tasks.create' THEN 'tasks:create' WHEN 'tasks.update' THEN 'tasks:update' WHEN 'comments.create' THEN 'tasks:comment' WHEN 'comments.update' THEN 'tasks:comment' WHEN 'comments.delete' THEN 'tasks:comment' ELSE 'tasks:read' END;
    IF cred.id IS NOT NULL AND p_operation<>'mcp.exchange' AND (NOT scope=ANY(cred.scopes) OR (session_record.id IS NOT NULL AND NOT scope=ANY(session_record.scopes))) THEN PERFORM tasks_api_private.fail(403,'INSUFFICIENT_SCOPE','Required task scope is missing'); END IF;
    INSERT INTO tasks_api_private.rate_limits(actor_id,window_start,requests) VALUES(actor.id,date_trunc('minute',clock_timestamp()),1)
    ON CONFLICT(actor_id,window_start) DO UPDATE SET requests=tasks_api_private.rate_limits.requests+1 RETURNING requests INTO rate_count;
    IF rate_count>120 THEN PERFORM tasks_api_private.fail(429,'RATE_LIMITED','Task request rate exceeded'); END IF;
  END IF;
  -- Typed business failures roll back all resource/audit/replay writes, but
  -- keep the authenticated actor's debit in the enclosing block. A threshold
  -- rejection above still rolls its increment back, preserving the stored 120.
  BEGIN
  IF p_operation IN ('tasks.create','tasks.update','comments.create','comments.update') THEN
    IF p_idempotency_key IS NULL OR length(p_idempotency_key) NOT BETWEEN 1 AND 200 THEN PERFORM tasks_api_private.fail(400,'VALIDATION_ERROR','A write idempotency key is required'); END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(actor.id::text||v_principal||p_operation||p_idempotency_key,0));
    SELECT * INTO cached FROM tasks_api_private.idempotency WHERE actor_id=actor.id AND tasks_api_private.idempotency.principal=v_principal AND operation=p_operation AND key=p_idempotency_key;
    IF FOUND THEN
      IF cached.payload<>p_payload THEN PERFORM tasks_api_private.fail(409,'IDEMPOTENCY_CONFLICT','Idempotency key was used with different input'); END IF;
      IF p_operation LIKE 'comments.%' THEN
        IF NOT EXISTS(SELECT 1 FROM public.omnia_ticket_comments WHERE id=(cached.response#>>'{data,id}')::uuid) THEN PERFORM tasks_api_private.fail(404,'NOT_FOUND','Comment not found'); END IF;
      ELSIF NOT EXISTS(SELECT 1 FROM public.omnia_tickets WHERE id=(cached.response#>>'{data,id}')::uuid) THEN PERFORM tasks_api_private.fail(404,'NOT_FOUND','Task not found'); END IF;
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
    IF jsonb_array_length(p_payload->'scopes') NOT BETWEEN 1 AND 4 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'scopes') e WHERE jsonb_typeof(e)<>'string' OR e#>>'{}' NOT IN ('tasks:read','tasks:create','tasks:update','tasks:comment')) THEN PERFORM tasks_api_private.fail(400,'VALIDATION_ERROR','Invalid scopes'); END IF;
    IF p_payload ? 'expiresAt' AND jsonb_typeof(p_payload->'expiresAt') NOT IN ('string','null') THEN PERFORM tasks_api_private.fail(400,'VALIDATION_ERROR','Invalid credential expiration'); END IF;
    IF p_payload->>'expiresAt' IS NOT NULL AND ((p_payload->>'expiresAt')::timestamptz<=clock_timestamp() OR (p_payload->>'expiresAt')::timestamptz>clock_timestamp()+interval '365 days') THEN PERFORM tasks_api_private.fail(400,'VALIDATION_ERROR','Invalid credential expiration'); END IF;
    IF EXISTS(SELECT 1 FROM tasks_api_private.sessions WHERE token_digest=p_payload->>'tokenDigest') THEN PERFORM tasks_api_private.fail(409,'CONFLICT','Digest already exists'); END IF;
    INSERT INTO tasks_api_private.credentials(actor_id,auth_user_id,name,audience,scopes,token_digest,expires_at)
    VALUES(actor.id,verified_auth,btrim(p_payload->>'name'),p_payload->>'audience',ARRAY(SELECT DISTINCT jsonb_array_elements_text(p_payload->'scopes')),p_payload->>'tokenDigest',CASE WHEN p_payload ? 'expiresAt' THEN (p_payload->>'expiresAt')::timestamptz ELSE clock_timestamp()+interval '90 days' END) RETURNING * INTO cred;
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
   WHEN 'tags.list' THEN
    PERFORM tasks_api_private.keys(p_payload,ARRAY['query']);
    IF p_payload ? 'query' AND (jsonb_typeof(p_payload->'query') IS DISTINCT FROM 'string' OR length(p_payload->>'query')>500) THEN PERFORM tasks_api_private.fail(400,'VALIDATION_ERROR','Invalid query'); END IF;
    SELECT coalesce(jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'color',g.color) ORDER BY g.name,g.id),'[]'::jsonb) INTO result FROM public.omnia_tags g WHERE p_payload->>'query' IS NULL OR g.name ILIKE '%'||(p_payload->>'query')||'%';
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
    IF p_payload ? 'tags' AND cred.id IS NOT NULL THEN PERFORM tasks_api_private.assert_known_tags(p_payload->'tags','{}'); END IF;
    INSERT INTO public.omnia_tickets(title,description,priority,due_date,ticket_octa,status_id,assigned_to,created_by,tags,is_private,oportunidade_id)
    VALUES(btrim(p_payload->>'title'),p_payload->>'description',coalesce(p_payload->>'priority','NORMAL')::public.ticket_priority,(p_payload->>'dueDate')::date,p_payload->>'ticketOcta',coalesce((p_payload->>'statusId')::uuid,(SELECT id FROM public.omnia_ticket_statuses ORDER BY coalesce(is_default,false) DESC,order_position,id LIMIT 1)),(p_payload->>'assignedToId')::uuid,actor.id,
    CASE WHEN p_payload ? 'tags' THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'tags')) ELSE '{}'::text[] END,coalesce((p_payload->>'isPrivate')::boolean,false),(p_payload->>'oportunidadeId')::uuid) RETURNING * INTO v_task;
    IF p_payload ? 'recurrence' AND p_payload->'recurrence'<>'null'::jsonb THEN
      new_series:=tasks_api_private.set_recurrence(v_task,p_payload->'recurrence');
      UPDATE public.omnia_tickets SET recurrence_id=new_series,recurrence_occurrence=1,due_date=(p_payload#>>'{recurrence,startDate}')::date WHERE id=v_task.id RETURNING * INTO v_task;
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
    IF v_patch ? 'tags' AND cred.id IS NOT NULL THEN PERFORM tasks_api_private.assert_known_tags(v_patch->'tags',before_task.tags); END IF;
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
   WHEN 'comments.list' THEN
    PERFORM tasks_api_private.keys(p_payload,ARRAY['taskId','limit','cursor']);
    page_limit:=coalesce((p_payload->>'limit')::integer,50);
    IF page_limit NOT BETWEEN 1 AND 100 THEN PERFORM tasks_api_private.fail(400,'VALIDATION_ERROR','Limit must be 1 to 100'); END IF;
    IF p_payload ? 'cursor' AND p_payload->'cursor'<>'null'::jsonb THEN
      PERFORM tasks_api_private.keys(p_payload->'cursor',ARRAY['createdAt','id']);
      IF p_payload#>>'{cursor,createdAt}' IS NULL OR p_payload#>>'{cursor,id}' IS NULL THEN PERFORM tasks_api_private.fail(400,'VALIDATION_ERROR','Invalid cursor'); END IF;
    END IF;
    SELECT * INTO v_task FROM public.omnia_tickets WHERE id=(p_payload->>'taskId')::uuid;
    IF NOT FOUND THEN PERFORM tasks_api_private.fail(404,'NOT_FOUND','Task not found'); END IF;
    WITH rows AS (
      SELECT c.id,c.created_at,row_number() OVER(ORDER BY c.created_at DESC,c.id DESC) n FROM public.omnia_ticket_comments c
      WHERE c.ticket_id=v_task.id AND (p_payload#>>'{cursor,id}' IS NULL OR (c.created_at,c.id)<((p_payload#>>'{cursor,createdAt}')::timestamptz,(p_payload#>>'{cursor,id}')::uuid))
      ORDER BY c.created_at DESC,c.id DESC LIMIT page_limit+1
    )
    SELECT jsonb_build_object('items',coalesce(jsonb_agg(tasks_api_private.comment_dto(c) ORDER BY r.n) FILTER(WHERE r.n<=page_limit),'[]'::jsonb),
       'nextCursor',CASE WHEN count(*)>page_limit THEN (jsonb_agg(jsonb_build_object('createdAt',r.created_at,'id',r.id) ORDER BY r.n) FILTER(WHERE r.n=page_limit))->0 ELSE NULL END)
      INTO result FROM rows r JOIN public.omnia_ticket_comments c ON c.id=r.id;
   WHEN 'comments.create' THEN
    PERFORM tasks_api_private.keys(p_payload,ARRAY['taskId','body']);
    PERFORM tasks_api_private.validate_comment_body(p_payload);
    SELECT * INTO v_task FROM public.omnia_tickets WHERE id=(p_payload->>'taskId')::uuid;
    IF NOT FOUND THEN PERFORM tasks_api_private.fail(404,'NOT_FOUND','Task not found'); END IF;
    -- The author is always the verified actor; created_by stays NULL like browser-created comments.
    INSERT INTO public.omnia_ticket_comments(ticket_id,body,author_id) VALUES(v_task.id,p_payload->>'body',actor.id) RETURNING * INTO v_comment;
    result:=tasks_api_private.comment_dto(v_comment);
   WHEN 'comments.update' THEN
    PERFORM tasks_api_private.keys(p_payload,ARRAY['taskId','id','body']);
    PERFORM tasks_api_private.validate_comment_body(p_payload);
    SELECT * INTO v_task FROM public.omnia_tickets WHERE id=(p_payload->>'taskId')::uuid;
    IF NOT FOUND THEN PERFORM tasks_api_private.fail(404,'NOT_FOUND','Task not found'); END IF;
    SELECT * INTO v_comment FROM public.omnia_ticket_comments WHERE id=(p_payload->>'id')::uuid AND ticket_id=v_task.id;
    IF NOT FOUND THEN PERFORM tasks_api_private.fail(404,'NOT_FOUND','Comment not found'); END IF;
    -- No FOR UPDATE here: row locking would apply the author-only UPDATE policy and hide the row
    -- from non-authors, turning a 403 into a 404. The guarded UPDATE below is the atomic step.
    -- Same rule as the interface: only the author edits, administrators included.
    IF v_comment.author_id<>actor.id THEN PERFORM tasks_api_private.fail(403,'FORBIDDEN','Only the author can edit this comment'); END IF;
    UPDATE public.omnia_ticket_comments SET body=p_payload->>'body' WHERE id=v_comment.id RETURNING * INTO v_comment;
    IF NOT FOUND THEN PERFORM tasks_api_private.fail(404,'NOT_FOUND','Comment not found'); END IF;
    result:=tasks_api_private.comment_dto(v_comment);
   WHEN 'comments.delete' THEN
    PERFORM tasks_api_private.keys(p_payload,ARRAY['taskId','id']);
    SELECT * INTO v_task FROM public.omnia_tickets WHERE id=(p_payload->>'taskId')::uuid;
    IF NOT FOUND THEN PERFORM tasks_api_private.fail(404,'NOT_FOUND','Task not found'); END IF;
    SELECT * INTO v_comment FROM public.omnia_ticket_comments WHERE id=(p_payload->>'id')::uuid AND ticket_id=v_task.id;
    IF NOT FOUND THEN PERFORM tasks_api_private.fail(404,'NOT_FOUND','Comment not found'); END IF;
    -- Same rule as the interface: the author or an administrator deletes.
    IF v_comment.author_id<>actor.id AND NOT coalesce('ADMIN'=ANY(actor.roles),false) THEN PERFORM tasks_api_private.fail(403,'FORBIDDEN','Only the author or an administrator can delete this comment'); END IF;
    DELETE FROM public.omnia_ticket_comments WHERE id=v_comment.id RETURNING * INTO v_comment;
    IF NOT FOUND THEN PERFORM tasks_api_private.fail(404,'NOT_FOUND','Comment not found'); END IF;
    result:=tasks_api_private.comment_dto(v_comment);
   END CASE;
   response:=jsonb_build_object('status',CASE WHEN p_operation IN ('tasks.create','comments.create','credentials.create','mcp.exchange') THEN 201 ELSE 200 END,'data',result);
   IF p_operation IN ('tasks.create','tasks.update','comments.create','comments.update') THEN
     INSERT INTO tasks_api_private.idempotency(actor_id,principal,operation,key,payload,response) VALUES(actor.id,v_principal,p_operation,p_idempotency_key,p_payload,response);
   END IF;
   IF p_operation IN ('tasks.create','tasks.update','comments.create','comments.update','comments.delete','credentials.create','credentials.revoke','mcp.exchange') THEN
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
