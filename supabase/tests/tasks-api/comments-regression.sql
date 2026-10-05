\set ON_ERROR_STOP on
-- Task comment regressions run only in the isolated fixture and roll back completely.
-- Alice (USUARIO), Bob (USUARIO) and Admin (ADMIN) are 10000000-...-00N with auth ids 20000000-...-00N.
CREATE OR REPLACE FUNCTION public.test_assert(condition boolean, label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF condition IS DISTINCT FROM true THEN RAISE EXCEPTION 'Assertion failed: %',label; END IF; END $$;
CREATE OR REPLACE FUNCTION public.t_as(n integer, op text, payload jsonb, key text DEFAULT NULL) RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.tasks_api_dispatch(op,payload,('20000000-0000-0000-0000-00000000000'||n)::uuid,NULL,key)
$$;
CREATE OR REPLACE FUNCTION public.t_key(digest text, op text, payload jsonb, key text DEFAULT NULL) RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.tasks_api_dispatch(op,payload,NULL,digest,key)
$$;

CREATE OR REPLACE FUNCTION public.t_audit(op_like text, resource uuid DEFAULT NULL, credential_only boolean DEFAULT false) RETURNS bigint LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  SELECT count(*) FROM tasks_api_private.audit WHERE operation LIKE op_like AND (resource IS NULL OR resource_id=resource) AND (NOT credential_only OR credential_id IS NOT NULL)
$$;

BEGIN;
DELETE FROM tasks_api_private.rate_limits;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000003',true);
SELECT set_config('request.jwt.claim.role','service_role',true);
SELECT set_config('request.jwt.claims','{"role":"service_role","sub":"20000000-0000-0000-0000-000000000003"}',true);

SELECT public.t_as(1,'tasks.create','{"title":"Shared task"}','c-task') #>> '{data,id}' AS id \gset shared_
SELECT public.t_as(1,'tasks.create','{"title":"Private task","isPrivate":true}','c-private') #>> '{data,id}' AS id \gset private_
SELECT public.t_as(1,'tasks.create','{"title":"Other task"}','c-other') #>> '{data,id}' AS id \gset other_

-- Creation: the author is the verified actor and the task counter follows.
SELECT public.t_as(1,'comments.create',jsonb_build_object('taskId',:'shared_id','body','Primeiro'),'cm-1') AS r \gset c1_
SELECT public.test_assert((:'c1_r'::jsonb->>'status')::int=201,'Alice creates a comment');
SELECT public.test_assert(:'c1_r'::jsonb#>>'{data,authorId}'='10000000-0000-0000-0000-000000000001' AND :'c1_r'::jsonb#>>'{data,author,name}'='Alice','author derives from the verified actor');
SELECT public.test_assert(:'c1_r'::jsonb#>>'{data,taskId}'=:'shared_id' AND :'c1_r'::jsonb#>>'{data,body}'='Primeiro','comment DTO carries task and body');
SELECT public.test_assert((SELECT created_by IS NULL FROM public.omnia_ticket_comments WHERE id=(:'c1_r'::jsonb#>>'{data,id}')::uuid),'created_by stays NULL like browser-created comments');
SELECT public.test_assert((public.t_as(1,'tasks.get',jsonb_build_object('id',:'shared_id'))#>>'{data,commentCount}')::int=1,'comment counter incremented by the existing trigger');
SELECT public.test_assert(public.t_audit('comments.create',(:'c1_r'::jsonb#>>'{data,id}')::uuid)=1,'creation audited with the comment id');

-- Idempotency.
SELECT public.t_as(1,'comments.create',jsonb_build_object('taskId',:'shared_id','body','Primeiro'),'cm-1') AS r \gset c1replay_
SELECT public.test_assert(:'c1replay_r'::jsonb->'data'=:'c1_r'::jsonb->'data','replay returns the original comment');
SELECT public.test_assert((SELECT count(*) FROM public.omnia_ticket_comments WHERE ticket_id=:'shared_id')=1,'replay does not insert twice');
SELECT public.test_assert(public.t_as(1,'comments.create',jsonb_build_object('taskId',:'shared_id','body','Outro'),'cm-1')#>>'{error,code}'='IDEMPOTENCY_CONFLICT','same key with another body conflicts');
SELECT public.test_assert(public.t_as(1,'comments.create',jsonb_build_object('taskId',:'shared_id','body','x'))#>>'{error,code}'='VALIDATION_ERROR','write requires an idempotency key');

-- Any user with access to the task may comment, never as someone else.
SELECT public.t_as(2,'comments.create',jsonb_build_object('taskId',:'shared_id','body','Do Bob'),'cm-bob') AS r \gset c2_
SELECT public.test_assert(:'c2_r'::jsonb#>>'{data,authorId}'='10000000-0000-0000-0000-000000000002','Bob comments as Bob');
SELECT public.test_assert(public.t_as(2,'comments.create',jsonb_build_object('taskId',:'shared_id','body','x','authorId','10000000-0000-0000-0000-000000000001'),'cm-forged')#>>'{error,code}'='VALIDATION_ERROR','forged author is rejected');
SELECT public.test_assert(public.t_as(2,'comments.create',jsonb_build_object('taskId',:'shared_id','body','x','author_id','10000000-0000-0000-0000-000000000001'),'cm-forged2')#>>'{error,code}'='VALIDATION_ERROR','forged column name is rejected');

-- Validation.
SELECT public.test_assert(public.t_as(1,'comments.create',jsonb_build_object('taskId',:'shared_id','body',E' \n\t '),'cm-blank')#>>'{error,code}'='VALIDATION_ERROR','whitespace-only body rejected');
SELECT public.test_assert(public.t_as(1,'comments.create',jsonb_build_object('taskId',:'shared_id','body',repeat('x',10001)),'cm-long')#>>'{error,code}'='VALIDATION_ERROR','body above 10000 characters rejected');
SELECT public.test_assert(public.t_as(1,'comments.create',jsonb_build_object('taskId',:'shared_id','body',repeat('x',10000)),'cm-max')->>'status'='201','body at 10000 characters accepted');
SELECT public.test_assert(public.t_as(1,'comments.create',jsonb_build_object('taskId',:'shared_id','body',42),'cm-num')#>>'{error,code}'='VALIDATION_ERROR','non-string body rejected');
SELECT public.test_assert(public.t_as(1,'comments.create',jsonb_build_object('taskId',:'shared_id'),'cm-missing')#>>'{error,code}'='VALIDATION_ERROR','missing body rejected');
SELECT public.test_assert(public.t_as(1,'comments.create',jsonb_build_object('taskId','not-a-uuid','body','x'),'cm-badid')#>>'{error,code}'='VALIDATION_ERROR','malformed task id rejected');
SELECT public.test_assert(public.t_as(1,'comments.create',jsonb_build_object('taskId','ffffffff-ffff-ffff-ffff-ffffffffffff','body','x'),'cm-ghost')#>>'{error,code}'='NOT_FOUND','unknown task is not found');

-- Editing: author only, scoped to the task in the path.
SELECT public.test_assert(public.t_as(2,'comments.update',jsonb_build_object('taskId',:'shared_id','id',:'c1_r'::jsonb#>>'{data,id}','body','hijack'),'ed-bob')#>>'{error,code}'='FORBIDDEN','another user cannot edit');
SELECT public.test_assert(public.t_as(3,'comments.update',jsonb_build_object('taskId',:'shared_id','id',:'c1_r'::jsonb#>>'{data,id}','body','hijack'),'ed-admin')#>>'{error,code}'='FORBIDDEN','administrators cannot edit others comments either');
SELECT public.test_assert((SELECT body FROM public.omnia_ticket_comments WHERE id=(:'c1_r'::jsonb#>>'{data,id}')::uuid)='Primeiro','denied edits leave the body untouched');
SELECT public.t_as(1,'tasks.get',jsonb_build_object('id',:'shared_id'))#>>'{data,updatedAt}' AS v \gset before_edit_
SELECT public.t_as(1,'comments.update',jsonb_build_object('taskId',:'shared_id','id',:'c1_r'::jsonb#>>'{data,id}','body','Editado'),'ed-alice') AS r \gset e1_
SELECT public.test_assert(public.t_as(1,'tasks.get',jsonb_build_object('id',:'shared_id'))#>>'{data,updatedAt}'=:'before_edit_v','editing a comment does not change the task version');
SELECT public.test_assert(:'e1_r'::jsonb->>'status'='200' AND :'e1_r'::jsonb#>>'{data,body}'='Editado' AND :'e1_r'::jsonb#>>'{data,id}'=:'c1_r'::jsonb#>>'{data,id}' AND :'e1_r'::jsonb#>>'{data,createdAt}'=:'c1_r'::jsonb#>>'{data,createdAt}','author edits in place keeping identity and creation time');
SELECT public.test_assert(public.t_as(1,'comments.update',jsonb_build_object('taskId',:'other_id','id',:'c1_r'::jsonb#>>'{data,id}','body','wrong task'),'ed-wrongtask')#>>'{error,code}'='NOT_FOUND','comment is only reachable through its own task');
SELECT public.test_assert(public.t_as(1,'comments.update',jsonb_build_object('taskId',:'shared_id','id','ffffffff-ffff-ffff-ffff-ffffffffffff','body','x'),'ed-ghost')#>>'{error,code}'='NOT_FOUND','unknown comment is not found');
SELECT public.test_assert(public.t_as(1,'comments.update',jsonb_build_object('taskId',:'shared_id','id',:'c1_r'::jsonb#>>'{data,id}','body','Editado'),'ed-alice')->'data'=:'e1_r'::jsonb->'data','edit replay returns the original result');
SELECT public.test_assert(public.t_as(1,'comments.update',jsonb_build_object('taskId',:'shared_id','id',:'c1_r'::jsonb#>>'{data,id}','body',''),'ed-empty')#>>'{error,code}'='VALIDATION_ERROR','edit validates the body');
SELECT public.test_assert(public.t_audit('comments.update',(:'c1_r'::jsonb#>>'{data,id}')::uuid)=1,'edit audited once');

-- Deleting: author or administrator.
SELECT public.test_assert(public.t_as(2,'comments.delete',jsonb_build_object('taskId',:'shared_id','id',:'c1_r'::jsonb#>>'{data,id}'))#>>'{error,code}'='FORBIDDEN','another user cannot delete');
SELECT public.test_assert((SELECT count(*) FROM public.omnia_ticket_comments WHERE id=(:'c1_r'::jsonb#>>'{data,id}')::uuid)=1,'denied delete keeps the comment');
SELECT public.t_as(3,'comments.delete',jsonb_build_object('taskId',:'shared_id','id',:'c2_r'::jsonb#>>'{data,id}')) AS r \gset d2_
SELECT public.test_assert(:'d2_r'::jsonb->>'status'='200' AND :'d2_r'::jsonb#>>'{data,id}'=:'c2_r'::jsonb#>>'{data,id}','administrator deletes anyones comment and gets it back');
SELECT public.test_assert(public.t_as(3,'comments.delete',jsonb_build_object('taskId',:'shared_id','id',:'c2_r'::jsonb#>>'{data,id}'))#>>'{error,code}'='NOT_FOUND','second delete is not found');
SELECT public.t_as(1,'comments.delete',jsonb_build_object('taskId',:'shared_id','id',:'c1_r'::jsonb#>>'{data,id}')) AS r \gset d1_
SELECT public.test_assert(:'d1_r'::jsonb->>'status'='200','author deletes own comment');
SELECT public.test_assert(public.t_as(2,'comments.delete',jsonb_build_object('taskId',:'shared_id','id',:'c1_r'::jsonb#>>'{data,id}','extra',1))#>>'{error,code}'='VALIDATION_ERROR','delete payload is strict');
SELECT public.test_assert(public.t_audit('comments.delete')=2,'both deletions audited');
SELECT public.test_assert((public.t_as(1,'tasks.get',jsonb_build_object('id',:'shared_id'))#>>'{data,commentCount}')::int=1,'counter follows deletions (only the 10000-char comment remains)');

-- Deleting a comment cascades its notifications without extra worker grants.
RESET ROLE;
INSERT INTO public.omnia_ticket_comments(id,ticket_id,body,author_id) VALUES('50000000-0000-0000-0000-000000000001',:'shared_id','with notification','10000000-0000-0000-0000-000000000001');
INSERT INTO public.omnia_notifications(user_id,type,ticket_id,ticket_comment_id) VALUES('10000000-0000-0000-0000-000000000002','mentioned',:'shared_id','50000000-0000-0000-0000-000000000001');
SET LOCAL ROLE service_role;
SELECT public.test_assert(public.t_as(1,'comments.delete',jsonb_build_object('taskId',:'shared_id','id','50000000-0000-0000-0000-000000000001'))->>'status'='200','delete succeeds with dependent notification');
SELECT public.test_assert((SELECT count(*) FROM public.omnia_notifications WHERE ticket_comment_id='50000000-0000-0000-0000-000000000001')=0,'dependent notification removed by the existing cascade');

-- Private tasks: invisible tasks expose no comments, administrators keep access.
SELECT public.t_as(1,'comments.create',jsonb_build_object('taskId',:'private_id','body','Segredo'),'pv-alice') AS r \gset pv_
SELECT public.test_assert(:'pv_r'::jsonb->>'status'='201','creator comments on own private task');
SELECT public.test_assert(public.t_as(2,'comments.list',jsonb_build_object('taskId',:'private_id'))#>>'{error,code}'='NOT_FOUND','private task comments are hidden from Bob');
SELECT public.test_assert(public.t_as(2,'comments.create',jsonb_build_object('taskId',:'private_id','body','x'),'pv-bob')#>>'{error,code}'='NOT_FOUND','Bob cannot comment on a private task');
SELECT public.test_assert(public.t_as(2,'comments.update',jsonb_build_object('taskId',:'private_id','id',:'pv_r'::jsonb#>>'{data,id}','body','x'),'pv-bob-ed')#>>'{error,code}'='NOT_FOUND','Bob cannot edit on a private task');
SELECT public.test_assert(public.t_as(2,'comments.delete',jsonb_build_object('taskId',:'private_id','id',:'pv_r'::jsonb#>>'{data,id}'))#>>'{error,code}'='NOT_FOUND','Bob cannot delete on a private task');
SELECT public.test_assert(jsonb_array_length(public.t_as(3,'comments.list',jsonb_build_object('taskId',:'private_id'))#>'{data,items}')=1,'administrator lists private task comments');
SELECT public.test_assert(public.t_as(3,'comments.delete',jsonb_build_object('taskId',:'private_id','id',:'pv_r'::jsonb#>>'{data,id}'))->>'status'='200','administrator deletes on a private task');

-- Listing: newest first, bounded pages, opaque cursor.
SELECT public.t_as(1,'comments.create',jsonb_build_object('taskId',:'other_id','body','um'),'l-1') AS r \gset l1_
SELECT public.t_as(1,'comments.create',jsonb_build_object('taskId',:'other_id','body','dois'),'l-2') AS r \gset l2_
SELECT public.t_as(1,'comments.create',jsonb_build_object('taskId',:'other_id','body','tres'),'l-3') AS r \gset l3_
-- now() is frozen inside a transaction, so give the three comments distinct instants.
RESET ROLE;
UPDATE public.omnia_ticket_comments SET created_at=now()-interval '3 minutes' WHERE id=(:'l1_r'::jsonb#>>'{data,id}')::uuid;
UPDATE public.omnia_ticket_comments SET created_at=now()-interval '2 minutes' WHERE id=(:'l2_r'::jsonb#>>'{data,id}')::uuid;
UPDATE public.omnia_ticket_comments SET created_at=now()-interval '1 minute' WHERE id=(:'l3_r'::jsonb#>>'{data,id}')::uuid;
DELETE FROM tasks_api_private.rate_limits;
SET LOCAL ROLE service_role;
SELECT public.t_as(2,'comments.list',jsonb_build_object('taskId',:'other_id','limit',2)) AS r \gset page1_
SELECT public.test_assert(jsonb_array_length(:'page1_r'::jsonb#>'{data,items}')=2 AND :'page1_r'::jsonb#>>'{data,items,0,body}'='tres' AND :'page1_r'::jsonb#>>'{data,items,1,body}'='dois','first page is newest first');
SELECT public.test_assert(:'page1_r'::jsonb#>>'{data,nextCursor,id}'=:'page1_r'::jsonb#>>'{data,items,1,id}','cursor points at the last returned comment');
SELECT public.t_as(2,'comments.list',jsonb_build_object('taskId',:'other_id','limit',2,'cursor',:'page1_r'::jsonb#>'{data,nextCursor}')) AS r \gset page2_
SELECT public.test_assert(jsonb_array_length(:'page2_r'::jsonb#>'{data,items}')=1 AND :'page2_r'::jsonb#>>'{data,items,0,body}'='um' AND :'page2_r'::jsonb#>'{data,nextCursor}'='null'::jsonb,'last page has no cursor');
SELECT public.test_assert(public.t_as(2,'comments.list',jsonb_build_object('taskId',:'other_id','limit',0))#>>'{error,code}'='VALIDATION_ERROR','limit lower bound enforced');
SELECT public.test_assert(public.t_as(2,'comments.list',jsonb_build_object('taskId',:'other_id','limit',101))#>>'{error,code}'='VALIDATION_ERROR','limit upper bound enforced');
SELECT public.test_assert(public.t_as(2,'comments.list',jsonb_build_object('taskId',:'other_id','filter','x'))#>>'{error,code}'='VALIDATION_ERROR','list payload is strict');
SELECT public.test_assert(jsonb_array_length(public.t_as(2,'comments.list',jsonb_build_object('taskId',:'shared_id'))#>'{data,items}')=1,'listing never mixes comments from other tasks');

-- Scopes: comments need their own scope; reading needs tasks:read.
SELECT public.t_as(1,'credentials.create','{"name":"reader","audience":"api","scopes":["tasks:read","tasks:create","tasks:update"],"tokenDigest":"1111111111111111111111111111111111111111111111111111111111111111"}');
SELECT public.t_as(1,'credentials.create','{"name":"commenter","audience":"api","scopes":["tasks:comment"],"tokenDigest":"2222222222222222222222222222222222222222222222222222222222222222"}') AS r \gset k2_
SELECT public.test_assert(:'k2_r'::jsonb->>'status'='201' AND :'k2_r'::jsonb#>'{data,scopes}'='["tasks:comment"]'::jsonb,'a key can be issued with the comment scope');
SELECT public.t_as(1,'credentials.create','{"name":"full","audience":"api","scopes":["tasks:read","tasks:comment"],"tokenDigest":"3333333333333333333333333333333333333333333333333333333333333333"}');
SELECT public.test_assert(public.t_as(1,'credentials.create','{"name":"bogus","audience":"api","scopes":["tasks:comments"],"tokenDigest":"4444444444444444444444444444444444444444444444444444444444444444"}')#>>'{error,code}'='VALIDATION_ERROR','unknown scope still rejected');
SELECT public.test_assert(public.t_as(1,'credentials.create','{"name":"all","audience":"api","scopes":["tasks:read","tasks:create","tasks:update","tasks:comment"],"tokenDigest":"5555555555555555555555555555555555555555555555555555555555555555"}')->>'status'='201','all four scopes can be combined');
SELECT public.test_assert(public.t_key(repeat('1',64),'comments.create',jsonb_build_object('taskId',:'other_id','body','x'),'k1-c')#>>'{error,code}'='INSUFFICIENT_SCOPE','a key without the comment scope cannot create');
SELECT public.test_assert(public.t_key(repeat('1',64),'comments.update',jsonb_build_object('taskId',:'other_id','id',:'l1_r'::jsonb#>>'{data,id}','body','x'),'k1-u')#>>'{error,code}'='INSUFFICIENT_SCOPE','a key without the comment scope cannot edit');
SELECT public.test_assert(public.t_key(repeat('1',64),'comments.delete',jsonb_build_object('taskId',:'other_id','id',:'l1_r'::jsonb#>>'{data,id}'))#>>'{error,code}'='INSUFFICIENT_SCOPE','a key without the comment scope cannot delete');
SELECT public.test_assert(public.t_key(repeat('1',64),'comments.list',jsonb_build_object('taskId',:'other_id'))->>'status'='200','tasks:read lists comments');
SELECT public.test_assert(public.t_key(repeat('2',64),'comments.list',jsonb_build_object('taskId',:'other_id'))#>>'{error,code}'='INSUFFICIENT_SCOPE','the comment scope alone cannot read');
SELECT public.t_key(repeat('3',64),'comments.create',jsonb_build_object('taskId',:'other_id','body','via key'),'k3-c') AS r \gset k3c_
SELECT public.test_assert(:'k3c_r'::jsonb->>'status'='201' AND :'k3c_r'::jsonb#>>'{data,authorId}'='10000000-0000-0000-0000-000000000001','a key comments as its owner');
SELECT public.test_assert(public.t_key(repeat('3',64),'comments.create',jsonb_build_object('taskId',:'other_id','body','via key'),'k3-c')->'data'=:'k3c_r'::jsonb->'data','key replay shares the principal and returns the original');
SELECT public.test_assert(public.t_key(repeat('3',64),'comments.update',jsonb_build_object('taskId',:'other_id','id',:'l2_r'::jsonb#>>'{data,id}','body','x'),'k3-u')->>'status'='200','a key edits its owner own comment');
SELECT public.test_assert(public.t_key(repeat('3',64),'tasks.create','{"title":"scope"}','k3-t')#>>'{error,code}'='INSUFFICIENT_SCOPE','the comment scope does not grant task creation');
SELECT public.test_assert(public.t_audit('comments.%',NULL,true)=2,'key-driven comment writes record the credential');

-- MCP exchange keeps the scope intersection for comment writes.
SELECT public.t_as(1,'credentials.create','{"name":"mcp","audience":"mcp","scopes":["tasks:read","tasks:comment"],"tokenDigest":"6666666666666666666666666666666666666666666666666666666666666666"}');
SELECT public.test_assert(public.t_key(repeat('6',64),'mcp.exchange','{"sessionDigest":"7777777777777777777777777777777777777777777777777777777777777777"}')->>'status'='201','MCP key exchanges');
SELECT public.test_assert(public.t_key(repeat('7',64),'comments.create',jsonb_build_object('taskId',:'other_id','body','via mcp'),'m-c')->>'status'='201','capability from a comment-scoped MCP key can comment');
SELECT public.test_assert(public.t_key(repeat('7',64),'tasks.create','{"title":"nope"}','m-t')#>>'{error,code}'='INSUFFICIENT_SCOPE','capability cannot exceed its parent scopes');

SELECT public.test_assert(current_setting('request.jwt.claim.sub')='20000000-0000-0000-0000-000000000003' AND current_setting('request.jwt.claim.role')='service_role','caller JWT context restored after comment operations');
RESET ROLE;

-- Defence in depth: the worker role itself cannot step outside authorship or task visibility.
INSERT INTO public.omnia_ticket_comments(id,ticket_id,body,author_id) VALUES('50000000-0000-0000-0000-000000000002',:'shared_id','alice raw','10000000-0000-0000-0000-000000000001'),('50000000-0000-0000-0000-000000000003',:'private_id','private raw','10000000-0000-0000-0000-000000000001');
SET LOCAL ROLE omnia_tasks_worker;
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"20000000-0000-0000-0000-000000000002"}',true);
SELECT public.test_assert((SELECT count(*) FROM public.omnia_ticket_comments WHERE id='50000000-0000-0000-0000-000000000002')=1,'worker reads comments of visible tasks');
WITH changed AS (UPDATE public.omnia_ticket_comments SET body='tampered' WHERE id='50000000-0000-0000-0000-000000000002' RETURNING 1) SELECT public.test_assert((SELECT count(*) FROM changed)=0,'worker cannot update another authors comment') ;
WITH removed AS (DELETE FROM public.omnia_ticket_comments WHERE id='50000000-0000-0000-0000-000000000002' RETURNING 1) SELECT public.test_assert((SELECT count(*) FROM removed)=0,'worker cannot delete another authors comment as a plain user');
SELECT set_config('t.shared',:'shared_id',true);
DO $$ BEGIN
  BEGIN
    INSERT INTO public.omnia_ticket_comments(ticket_id,body,author_id) VALUES(current_setting('t.shared')::uuid,'forged','10000000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'forged author insert unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT public.test_assert((SELECT count(*) FROM public.omnia_ticket_comments WHERE id='50000000-0000-0000-0000-000000000003')=0,'worker sees no comments of a private task it cannot read');
ROLLBACK;
SELECT 'comments regression passed' AS result;
