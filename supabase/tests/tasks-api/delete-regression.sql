\set ON_ERROR_STOP on
-- Task deletion regressions run only in the isolated fixture and roll back completely.
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
-- A task without a creator (legacy row): only an administrator may delete it.
INSERT INTO public.omnia_tickets(id,title,status_id,created_by)
VALUES ('60000000-0000-0000-0000-000000000001','orphan',(SELECT id FROM public.omnia_ticket_statuses LIMIT 1),NULL);
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
SELECT set_config('request.jwt.claim.role','service_role',true);
SELECT set_config('request.jwt.claims','{"role":"service_role","sub":"20000000-0000-0000-0000-000000000001"}',true);

-- Alice creates a task she will later delete herself.
SELECT public.t_as(1,'tasks.create','{"title":"alice task"}','del-create') AS r \gset mine_
SELECT public.test_assert(:'mine_r'::jsonb->>'status'='201','baseline: Alice creates a task');

-- Creator-or-admin rule: Bob is denied, and the task survives the attempt.
SELECT public.test_assert(public.t_as(2,'tasks.delete',jsonb_build_object('id',:'mine_r'::jsonb#>>'{data,id}'))#>>'{error,code}'='FORBIDDEN','a non-creator user cannot delete someone else''s task');
SELECT public.test_assert(EXISTS(SELECT 1 FROM public.omnia_tickets WHERE id=(:'mine_r'::jsonb#>>'{data,id}')::uuid),'a denied delete leaves the task in place');
SELECT public.test_assert(public.t_as(1,'tasks.delete',jsonb_build_object('id','60000000-0000-0000-0000-000000000001'))#>>'{error,code}'='FORBIDDEN','a task without a creator is administrator-only');

-- Alice deletes her task: the representation is returned, the row and its comments are gone.
-- The schema has no foreign key from comments or attachments to the task, and the worker may normally
-- delete only its own comments: the task delete must still clear comments written by other people.
SELECT public.t_as(1,'comments.create',jsonb_build_object('taskId',:'mine_r'::jsonb#>>'{data,id}','body','by alice'),'del-comment-a') AS r \gset ca_
SELECT public.t_as(2,'comments.create',jsonb_build_object('taskId',:'mine_r'::jsonb#>>'{data,id}','body','by bob'),'del-comment-b') AS r \gset cb_
SELECT public.t_as(1,'tasks.create','{"title":"alice other task"}','del-other') AS r \gset other_
SELECT public.t_as(2,'comments.create',jsonb_build_object('taskId',:'other_r'::jsonb#>>'{data,id}','body','survives'),'del-comment-other') AS r \gset co_
RESET ROLE;
INSERT INTO public.omnia_ticket_attachments(ticket_id,name,url,comment_id) VALUES
 ((:'mine_r'::jsonb#>>'{data,id}')::uuid,'direct.pdf','https://example.test/storage/v1/object/public/attachments/alice/direct.pdf',NULL),
 ((:'mine_r'::jsonb#>>'{data,id}')::uuid,'on-comment.png','https://example.test/storage/v1/object/public/attachments/bob/on-comment.png',(:'cb_r'::jsonb#>>'{data,id}')::uuid),
 ((:'other_r'::jsonb#>>'{data,id}')::uuid,'other.pdf','https://example.test/storage/v1/object/public/attachments/alice/other.pdf',NULL);
SET LOCAL ROLE service_role;
SELECT public.test_assert(public.t_as(2,'tasks.delete',jsonb_build_object('id',:'mine_r'::jsonb#>>'{data,id}'))#>>'{error,code}'='FORBIDDEN','the non-creator is still denied with comments and attachments present');
SELECT public.test_assert((SELECT count(*) FROM public.omnia_ticket_comments WHERE ticket_id=(:'mine_r'::jsonb#>>'{data,id}')::uuid)=2 AND (SELECT count(*) FROM public.omnia_ticket_attachments WHERE ticket_id=(:'mine_r'::jsonb#>>'{data,id}')::uuid)=2,'a denied delete removes no dependent rows');
SELECT public.t_as(1,'tasks.delete',jsonb_build_object('id',:'mine_r'::jsonb#>>'{data,id}')) AS r \gset del_
SELECT public.test_assert(:'del_r'::jsonb->>'status'='200' AND :'del_r'::jsonb#>>'{data,id}'=:'mine_r'::jsonb#>>'{data,id}','the creator deletes her task and gets it back');
SELECT public.test_assert(NOT EXISTS(SELECT 1 FROM public.omnia_tickets WHERE id=(:'mine_r'::jsonb#>>'{data,id}')::uuid),'the task row is removed');
SELECT public.test_assert(NOT EXISTS(SELECT 1 FROM public.omnia_ticket_comments WHERE ticket_id=(:'mine_r'::jsonb#>>'{data,id}')::uuid),'comments by every author are removed, none left orphaned');
SELECT public.test_assert(NOT EXISTS(SELECT 1 FROM public.omnia_ticket_attachments WHERE ticket_id=(:'mine_r'::jsonb#>>'{data,id}')::uuid OR comment_id=(:'cb_r'::jsonb#>>'{data,id}')::uuid),'direct and comment attachments are removed');
SELECT public.test_assert(jsonb_array_length(:'del_r'::jsonb->'removedFiles')=2 AND :'del_r'::jsonb->'removedFiles' @> '["https://example.test/storage/v1/object/public/attachments/alice/direct.pdf","https://example.test/storage/v1/object/public/attachments/bob/on-comment.png"]'::jsonb,'the stored file URLs are returned for cleanup');
SELECT public.test_assert(EXISTS(SELECT 1 FROM public.omnia_ticket_comments WHERE body='survives') AND EXISTS(SELECT 1 FROM public.omnia_ticket_attachments WHERE name='other.pdf'),'another task keeps its comments and attachments');
-- The deletion mark does not leak: a task creator still cannot delete someone else's comment.
SELECT public.test_assert(public.t_as(1,'comments.delete',jsonb_build_object('taskId',:'other_r'::jsonb#>>'{data,id}','id',:'co_r'::jsonb#>>'{data,id}'))#>>'{error,code}'='FORBIDDEN','comments.delete keeps its author-or-admin rule after a task delete');
SELECT public.test_assert(public.t_as(1,'tasks.delete',jsonb_build_object('id',:'mine_r'::jsonb#>>'{data,id}'))#>>'{error,code}'='NOT_FOUND','a repeated delete answers NOT_FOUND');
SELECT public.test_assert(public.t_as(1,'tasks.delete','{"id":"not-a-uuid"}')#>>'{error,code}'='VALIDATION_ERROR','a malformed id is rejected before any lookup');
SELECT public.test_assert(public.t_as(1,'tasks.delete',jsonb_build_object('id','60000000-0000-0000-0000-000000000001','title','x'))#>>'{error,code}'='VALIDATION_ERROR','unknown fields are rejected');

-- Administrators delete any task, including tasks without a creator.
SELECT public.test_assert(public.t_as(3,'tasks.delete','{"id":"60000000-0000-0000-0000-000000000001"}')->>'status'='200','an administrator deletes a task without a creator');

-- Keys: the operation needs tasks:delete; a key without it is denied, and a key with it acts as its owner.
SELECT public.t_as(1,'credentials.create',jsonb_build_object('name','updater','audience','api','scopes','["tasks:read","tasks:update"]'::jsonb,'tokenDigest',repeat('e1',32))) AS r \gset upd_
SELECT public.t_as(1,'credentials.create',jsonb_build_object('name','deleter','audience','api','scopes','["tasks:read","tasks:delete"]'::jsonb,'tokenDigest',repeat('e2',32))) AS r \gset del_key_
SELECT public.t_as(1,'tasks.create','{"title":"key target"}','del-key-target') AS r \gset kt_
SELECT public.test_assert(public.t_key(repeat('e1',32),'tasks.delete',jsonb_build_object('id',:'kt_r'::jsonb#>>'{data,id}'))#>>'{error,code}'='INSUFFICIENT_SCOPE','a key without tasks:delete cannot delete');
SELECT public.test_assert(public.t_key(repeat('e2',32),'tasks.delete',jsonb_build_object('id',:'kt_r'::jsonb#>>'{data,id}'))->>'status'='200','a key with tasks:delete deletes as its owner');
SELECT public.test_assert(NOT EXISTS(SELECT 1 FROM public.omnia_tickets WHERE id=(:'kt_r'::jsonb#>>'{data,id}')::uuid),'the key-driven delete removes the row');

RESET ROLE;
-- Audit and credential tables are internal to the worker; check them as the fixture owner.
SELECT public.test_assert(EXISTS(SELECT 1 FROM tasks_api_private.audit WHERE operation='tasks.delete' AND credential_id IS NOT NULL),'the key-driven delete is audited with its credential');
SELECT public.test_assert(NOT (SELECT scopes FROM tasks_api_private.credentials WHERE token_digest=repeat('e1',32))@>ARRAY['tasks:delete'],'a key issued without the delete scope does not gain it');
ROLLBACK;
SELECT 'delete regression passed' AS result;
