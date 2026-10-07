\set ON_ERROR_STOP on
-- Task tag catalog regressions run only in the isolated fixture and roll back completely.
-- Alice (USUARIO), Bob (USUARIO) and Admin (ADMIN) are 10000000-...-00N with auth ids 20000000-...-00N.
CREATE OR REPLACE FUNCTION public.test_assert(condition boolean, label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF condition IS DISTINCT FROM true THEN RAISE EXCEPTION 'Assertion failed: %',label; END IF; END $$;
CREATE OR REPLACE FUNCTION public.t_as(n integer, op text, payload jsonb, key text DEFAULT NULL) RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.tasks_api_dispatch(op,payload,('20000000-0000-0000-0000-00000000000'||n)::uuid,NULL,key)
$$;
CREATE OR REPLACE FUNCTION public.t_key(digest text, op text, payload jsonb, key text DEFAULT NULL) RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.tasks_api_dispatch(op,payload,NULL,digest,key)
$$;

BEGIN;
DELETE FROM tasks_api_private.rate_limits;
INSERT INTO public.omnia_tags(id,name,color) VALUES
('50000000-0000-0000-0000-000000000001','Urgente','#ef4444'),
('50000000-0000-0000-0000-000000000002','financeiro','#22c55e'),
('50000000-0000-0000-0000-000000000003','Assembleia','#6366f1');
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000003',true);
SELECT set_config('request.jwt.claim.role','service_role',true);
SELECT set_config('request.jwt.claims','{"role":"service_role","sub":"20000000-0000-0000-0000-000000000003"}',true);

-- Listing: whole catalog, ordered by name, with the public representation only.
SELECT public.t_as(1,'tags.list','{}') AS r \gset all_
SELECT public.test_assert(:'all_r'::jsonb->>'status'='200','a browser user lists tags');
SELECT public.test_assert(jsonb_array_length(:'all_r'::jsonb->'data')=3,'the whole catalog is returned');
SELECT public.test_assert((SELECT array_agg(e->>'name' ORDER BY ord) FROM jsonb_array_elements(:'all_r'::jsonb->'data') WITH ORDINALITY x(e,ord))=ARRAY['Assembleia','financeiro','Urgente'],'tags are ordered by name');
SELECT public.test_assert(:'all_r'::jsonb#>>'{data,2,id}'='50000000-0000-0000-0000-000000000001' AND :'all_r'::jsonb#>>'{data,2,color}'='#ef4444','id and color are exposed');
SELECT public.test_assert((SELECT bool_and(ARRAY(SELECT jsonb_object_keys(e) ORDER BY 1)=ARRAY['color','id','name']) FROM jsonb_array_elements(:'all_r'::jsonb->'data') e),'only id, name and color are exposed');

-- Query filter: case-insensitive substring; no match is an empty array, not an error.
SELECT public.test_assert(jsonb_array_length(public.t_as(1,'tags.list','{"query":"urg"}')->'data')=1,'query matches case-insensitively');
SELECT public.test_assert(public.t_as(1,'tags.list','{"query":"zzz"}')->'data'='[]'::jsonb,'an unmatched query returns an empty array');

-- Validation: unknown keys and a non-string query are rejected.
SELECT public.test_assert(public.t_as(1,'tags.list','{"limit":5}')#>>'{error,code}'='VALIDATION_ERROR','unknown keys are rejected');
SELECT public.test_assert(public.t_as(1,'tags.list','{"query":42}')#>>'{error,code}'='VALIDATION_ERROR','a non-string query is rejected');
SELECT public.test_assert(public.t_as(1,'tags.list',jsonb_build_object('query',repeat('x',501)))#>>'{error,code}'='VALIDATION_ERROR','an oversized query is rejected');

-- Scope: tags.list needs tasks:read, like the other read operations.
SELECT public.t_as(1,'credentials.create',jsonb_build_object('name','create-only','audience','api','scopes','["tasks:create"]'::jsonb,'tokenDigest',repeat('d1',32))) AS r \gset w_
SELECT public.t_as(1,'credentials.create',jsonb_build_object('name','reader','audience','api','scopes','["tasks:read"]'::jsonb,'tokenDigest',repeat('d2',32))) AS r \gset rd_
SELECT public.test_assert(public.t_key(repeat('d1',32),'tags.list','{}')#>>'{error,code}'='INSUFFICIENT_SCOPE','a key without tasks:read cannot list tags');
SELECT public.test_assert(jsonb_array_length(public.t_key(repeat('d2',32),'tags.list','{}')->'data')=3,'a tasks:read key lists tags');

-- Integration writes only use catalogued tags; the browser still creates tags on the fly.
SELECT public.t_as(1,'credentials.create',jsonb_build_object('name','writer','audience','api','scopes','["tasks:read","tasks:create","tasks:update"]'::jsonb,'tokenDigest',repeat('d3',32))) AS r \gset wr_
SELECT public.test_assert(public.t_key(repeat('d3',32),'tasks.create','{"title":"ok","tags":["Urgente","financeiro"]}','tg-ok')->>'status'='201','a key creates a task with catalogued tags');
SELECT public.test_assert(public.t_key(repeat('d3',32),'tasks.create','{"title":"empty","tags":[]}','tg-empty')->>'status'='201','an empty tag list is accepted');
SELECT public.test_assert(public.t_key(repeat('d3',32),'tasks.create','{"title":"no tags"}','tg-none')->>'status'='201','omitting tags is accepted');
SELECT public.test_assert(public.t_key(repeat('d3',32),'tasks.create','{"title":"bad","tags":["Urgente","inventada"]}','tg-bad')#>>'{error,code}'='UNKNOWN_TAG','a key cannot create a task with an unknown tag');
SELECT public.test_assert(public.t_key(repeat('d3',32),'tasks.create','{"title":"case","tags":["urgente"]}','tg-case')#>>'{error,code}'='UNKNOWN_TAG','tag names match exactly, including case');
SELECT public.test_assert(public.t_key(repeat('d3',32),'tasks.create','{"title":"bad","tags":["inventada"]}','tg-bad2')->>'status'='400','an unknown tag answers 400');
SELECT public.test_assert(NOT EXISTS(SELECT 1 FROM public.omnia_tickets WHERE title IN ('bad','case')) AND NOT EXISTS(SELECT 1 FROM public.omnia_tags WHERE name IN ('inventada','urgente')),'a rejected write persists no task and creates no tag');
SELECT public.test_assert(public.t_as(1,'tasks.create','{"title":"browser","tags":["legado"]}','tg-browser')->>'status'='201','the browser may still use a tag outside the catalog');
SELECT public.t_as(1,'tasks.create','{"title":"legacy","tags":["legado","Urgente"]}','tg-legacy') AS r \gset lg_
-- Update: tags the task already carries stay allowed, only new names must exist.
SELECT public.test_assert(public.t_key(repeat('d3',32),'tasks.update',jsonb_build_object('id',:'lg_r'::jsonb#>>'{data,id}','expectedUpdatedAt',:'lg_r'::jsonb#>>'{data,updatedAt}','patch','{"tags":["legado","nova-inexistente"]}'::jsonb),'tg-up-bad')#>>'{error,code}'='UNKNOWN_TAG','an update cannot add an unknown tag');
SELECT public.test_assert((SELECT tags FROM public.omnia_tickets WHERE id=(:'lg_r'::jsonb#>>'{data,id}')::uuid)=ARRAY['legado','Urgente'],'a rejected update leaves the tags untouched');
SELECT public.t_key(repeat('d3',32),'tasks.update',jsonb_build_object('id',:'lg_r'::jsonb#>>'{data,id}','expectedUpdatedAt',:'lg_r'::jsonb#>>'{data,updatedAt}','patch','{"tags":["legado","Assembleia"]}'::jsonb),'tg-up-ok') AS r \gset up_
SELECT public.test_assert(:'up_r'::jsonb->>'status'='200' AND :'up_r'::jsonb#>'{data,tags}'='["legado","Assembleia"]'::jsonb,'an update keeps its existing tag and adds a catalogued one');
SELECT public.test_assert(public.t_key(repeat('d3',32),'tasks.update',jsonb_build_object('id',:'lg_r'::jsonb#>>'{data,id}','expectedUpdatedAt',:'up_r'::jsonb#>>'{data,updatedAt}','patch','{"title":"renamed"}'::jsonb),'tg-up-title')->>'status'='200','a patch without tags is not subject to the check');
SELECT public.test_assert(public.t_as(1,'tasks.get',jsonb_build_object('id',:'lg_r'::jsonb#>>'{data,id}'))#>'{data,tags}'='["legado","Assembleia"]'::jsonb,'the browser reads the stored tags');

-- The same gate as tasks: a user without task access is denied, and the worker cannot write tags.
SELECT public.test_assert(public.t_as(1,'tags.list','{}')->>'status'='200','baseline: Alice has task access');
RESET ROLE;
DELETE FROM public.omnia_role_permissions WHERE role_name='USUARIO';
SET LOCAL ROLE service_role;
SELECT public.test_assert(public.t_as(1,'tags.list','{}')#>>'{error,code}'='FORBIDDEN','a user without /tarefas access is denied');
RESET ROLE;
SELECT public.test_assert(NOT has_table_privilege('omnia_tasks_worker','public.omnia_tags','INSERT') AND NOT has_table_privilege('omnia_tasks_worker','public.omnia_tags','UPDATE') AND NOT has_table_privilege('omnia_tasks_worker','public.omnia_tags','DELETE'),'the worker role has read-only access to tags');
ROLLBACK;
SELECT 'tags regression passed' AS result;
