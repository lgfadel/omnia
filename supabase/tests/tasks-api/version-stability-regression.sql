\set ON_ERROR_STOP on
-- A task's version (updated_at, exposed as updatedAt/ETag) must move only when the task itself
-- is edited. Derived counters (comment_count, attachment_count) maintained by triggers must not
-- invalidate somebody else's in-flight edit. Runs in the isolated fixture and rolls back.
CREATE OR REPLACE FUNCTION public.test_assert(condition boolean, label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF condition IS DISTINCT FROM true THEN RAISE EXCEPTION 'Assertion failed: %',label; END IF; END $$;
CREATE OR REPLACE FUNCTION public.t_as(n integer, op text, payload jsonb, key text DEFAULT NULL) RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.tasks_api_dispatch(op,payload,('20000000-0000-0000-0000-00000000000'||n)::uuid,NULL,key)
$$;

BEGIN;
DELETE FROM tasks_api_private.rate_limits;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000003',true);
SELECT set_config('request.jwt.claim.role','service_role',true);
SELECT set_config('request.jwt.claims','{"role":"service_role","sub":"20000000-0000-0000-0000-000000000003"}',true);

SELECT public.t_as(1,'tasks.create','{"title":"Version task"}','v-task') #>> '{data,id}' AS id \gset task_
RESET ROLE;
-- now() is frozen inside a transaction: pin a distinctive past instant so any bump is observable.
ALTER TABLE public.omnia_tickets DISABLE TRIGGER update_tickets_updated_at;
UPDATE public.omnia_tickets SET updated_at='2026-01-01 00:00:00.123456+00' WHERE id=:'task_id';
ALTER TABLE public.omnia_tickets ENABLE TRIGGER update_tickets_updated_at;
SET LOCAL ROLE service_role;
SELECT public.t_as(1,'tasks.get',jsonb_build_object('id',:'task_id')) AS r \gset v0_
SELECT public.test_assert(:'v0_r'::jsonb#>>'{data,updatedAt}'='2026-01-01T00:00:00.123456+00:00','fixture pinned the task version');

-- Counter-only changes keep the version.
SELECT public.t_as(2,'comments.create',jsonb_build_object('taskId',:'task_id','body','Bob comenta'),'v-c1') AS r \gset c1_
SELECT public.t_as(1,'tasks.get',jsonb_build_object('id',:'task_id')) AS r \gset v1_
SELECT public.test_assert((:'v1_r'::jsonb#>>'{data,commentCount}')::int=1,'the comment counter still increments');
SELECT public.test_assert(:'v1_r'::jsonb#>>'{data,updatedAt}'=:'v0_r'::jsonb#>>'{data,updatedAt}','creating a comment keeps the task version');
SELECT public.t_as(2,'comments.delete',jsonb_build_object('taskId',:'task_id','id',:'c1_r'::jsonb#>>'{data,id}')) AS r \gset d1_
SELECT public.t_as(1,'tasks.get',jsonb_build_object('id',:'task_id')) AS r \gset v2_
SELECT public.test_assert((:'v2_r'::jsonb#>>'{data,commentCount}')::int=0 AND :'v2_r'::jsonb#>>'{data,updatedAt}'=:'v0_r'::jsonb#>>'{data,updatedAt}','deleting a comment keeps the task version');
RESET ROLE;
UPDATE public.omnia_tickets SET attachment_count=attachment_count+1 WHERE id=:'task_id';
SELECT public.test_assert((SELECT updated_at='2026-01-01 00:00:00.123456+00' AND attachment_count=1 FROM public.omnia_tickets WHERE id=:'task_id'),'attachment counter changes keep the task version');
UPDATE public.omnia_tickets SET attachment_count=attachment_count+1,comment_count=comment_count+1 WHERE id=:'task_id';
SELECT public.test_assert((SELECT updated_at='2026-01-01 00:00:00.123456+00' FROM public.omnia_tickets WHERE id=:'task_id'),'both counters together keep the task version');

-- Any real edit still moves it, even when it rides along with a counter.
UPDATE public.omnia_tickets SET title='Edited by SQL' WHERE id=:'task_id';
SELECT public.test_assert((SELECT updated_at>'2026-01-01 00:00:00.123456+00' FROM public.omnia_tickets WHERE id=:'task_id'),'editing a field bumps the version');
UPDATE public.omnia_tickets SET updated_at='2026-01-01 00:00:00.123456+00' WHERE id=:'task_id';
UPDATE public.omnia_tickets SET updated_at='2026-01-01 00:00:00.123456+00',comment_count=comment_count+1,priority='URGENTE' WHERE id=:'task_id';
SELECT public.test_assert((SELECT updated_at>'2026-01-01 00:00:00.123456+00' FROM public.omnia_tickets WHERE id=:'task_id'),'a field edit combined with a counter still bumps the version');
-- Keep the historic behaviour of a no-op write: it is still an update of the task.
ALTER TABLE public.omnia_tickets DISABLE TRIGGER update_tickets_updated_at;
UPDATE public.omnia_tickets SET updated_at='2026-01-01 00:00:00.123456+00' WHERE id=:'task_id';
ALTER TABLE public.omnia_tickets ENABLE TRIGGER update_tickets_updated_at;
UPDATE public.omnia_tickets SET title=title WHERE id=:'task_id';
SELECT public.test_assert((SELECT updated_at>'2026-01-01 00:00:00.123456+00' FROM public.omnia_tickets WHERE id=:'task_id'),'a no-op update keeps bumping the version as before');

-- The scenario that motivated this: A reads, B comments, A saves with the version A read.
ALTER TABLE public.omnia_tickets DISABLE TRIGGER update_tickets_updated_at;
UPDATE public.omnia_tickets SET updated_at='2026-02-01 00:00:00.654321+00' WHERE id=:'task_id';
ALTER TABLE public.omnia_tickets ENABLE TRIGGER update_tickets_updated_at;
SET LOCAL ROLE service_role;
SELECT public.t_as(1,'tasks.get',jsonb_build_object('id',:'task_id')) AS r \gset a_
SELECT public.t_as(2,'comments.create',jsonb_build_object('taskId',:'task_id','body','durante a edição'),'v-c2') AS r \gset c2_
SELECT public.t_as(1,'tasks.update',jsonb_build_object('id',:'task_id','expectedUpdatedAt',:'a_r'::jsonb#>>'{data,updatedAt}','patch','{"description":"A salvou"}'::jsonb),'v-save') AS r \gset save_
SELECT public.test_assert(:'save_r'::jsonb->>'status'='200' AND :'save_r'::jsonb#>>'{data,description}'='A salvou','a comment added meanwhile does not invalidate the editor version');
SELECT public.test_assert((:'save_r'::jsonb#>>'{data,commentCount}')::int>=1,'the saved task still reflects the new comment count');
-- A genuine concurrent field edit is still caught. Real calls are separate transactions; inside this
-- single one now() never advances, so pin the version A just produced to a past instant first.
RESET ROLE;
ALTER TABLE public.omnia_tickets DISABLE TRIGGER update_tickets_updated_at;
UPDATE public.omnia_tickets SET updated_at='2026-03-01 00:00:00.111111+00' WHERE id=:'task_id';
ALTER TABLE public.omnia_tickets ENABLE TRIGGER update_tickets_updated_at;
SET LOCAL ROLE service_role;
SELECT public.t_as(1,'tasks.get',jsonb_build_object('id',:'task_id'))#>>'{data,updatedAt}' AS v \gset current_
SELECT public.t_as(2,'tasks.update',jsonb_build_object('id',:'task_id','expectedUpdatedAt',:'current_v','patch','{"title":"Bob mudou"}'::jsonb),'v-bob') AS r \gset bob_
SELECT public.test_assert(:'bob_r'::jsonb->>'status'='200','Bob edits with the current version');
SELECT public.test_assert(public.t_as(1,'tasks.update',jsonb_build_object('id',:'task_id','expectedUpdatedAt',:'current_v','patch','{"title":"stale"}'::jsonb),'v-stale')#>>'{error,code}'='PRECONDITION_FAILED','a real concurrent edit still yields 412');
ROLLBACK;
SELECT 'version stability regression passed' AS result;
