\set ON_ERROR_STOP on
CREATE OR REPLACE FUNCTION public.test_assert(condition boolean, label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF condition IS DISTINCT FROM true THEN RAISE EXCEPTION 'Assertion failed: %',label; END IF; END $$;
SELECT public.test_assert(to_regprocedure('public.tasks_api_dispatch(text,jsonb,uuid,text,text,uuid)') IS NOT NULL, 'service-only task dispatcher must exist');
-- Behavioral assertions follow only once the interface exists.
SET ROLE service_role;
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000003',false);
SELECT set_config('request.jwt.claim.role','service_role',false);
SELECT set_config('request.jwt.claims','{"role":"service_role","sub":"20000000-0000-0000-0000-000000000003"}',false);
SELECT public.tasks_api_dispatch('tasks.create','{"title":"Private Alice","isPrivate":true,"statusId":"40000000-0000-0000-0000-000000000001","dueDate":"2026-10-05","ticketOcta":"external-9"}', '20000000-0000-0000-0000-000000000001',NULL,'create-private') AS response \gset private_
SELECT public.test_assert((:'private_response'::jsonb->>'status')::int=201, 'Alice can create her private task');
SELECT public.test_assert(:'private_response'::jsonb#>>'{data,createdById}'='10000000-0000-0000-0000-000000000001','creator derives from verified Alice, never stale service claims');
SELECT public.test_assert(:'private_response'::jsonb#>>'{data,ticketOcta}'='external-9','external ticket number separate from sequence');
SELECT public.test_assert((:'private_response'::jsonb#>>'{data,ticketId}')::int>0,'public task number generated');
SELECT public.test_assert(auth.uid()='20000000-0000-0000-0000-000000000003' AND auth.role()='service_role','legacy JWT context restored');
SELECT public.test_assert(current_setting('request.jwt.claims')::jsonb='{"role":"service_role","sub":"20000000-0000-0000-0000-000000000003"}'::jsonb,'JSON JWT context restored');
SELECT public.tasks_api_dispatch('tasks.create','{"title":"Private Alice","isPrivate":true,"statusId":"40000000-0000-0000-0000-000000000001","dueDate":"2026-10-05","ticketOcta":"external-9"}', '20000000-0000-0000-0000-000000000001',NULL,'create-private') AS response \gset replay_
SELECT public.test_assert(:'replay_response'::jsonb->'data'=:'private_response'::jsonb->'data','idempotency returns same row');
SELECT public.test_assert(public.tasks_api_dispatch('tasks.create','{"title":"different"}','20000000-0000-0000-0000-000000000001',NULL,'create-private')#>>'{error,code}'='IDEMPOTENCY_CONFLICT','key reuse cannot change payload');
SELECT public.test_assert(public.tasks_api_dispatch('tasks.get',jsonb_build_object('id',:'private_response'::jsonb#>>'{data,id}'),'20000000-0000-0000-0000-000000000002')#>>'{error,code}'='NOT_FOUND','private task hidden from Bob');
SELECT public.test_assert(public.tasks_api_dispatch('tasks.get',jsonb_build_object('id',:'private_response'::jsonb#>>'{data,id}'),'20000000-0000-0000-0000-000000000003')->>'status'='200','ADMIN sees private task');
SELECT public.test_assert(public.tasks_api_dispatch('tasks.create','{"title":"forged","createdById":"10000000-0000-0000-0000-000000000003"}','20000000-0000-0000-0000-000000000001',NULL,'forged')#>>'{error,code}'='VALIDATION_ERROR','forged actor fields rejected');
SELECT public.tasks_api_dispatch('tasks.update',jsonb_build_object('id',:'private_response'::jsonb#>>'{data,id}','expectedUpdatedAt',:'private_response'::jsonb#>>'{data,updatedAt}','patch',jsonb_build_object('description','new','dueDate',NULL)),'20000000-0000-0000-0000-000000000001',NULL,'update-clear') AS response \gset updated_
SELECT public.test_assert(:'updated_response'::jsonb->>'status'='200' AND :'updated_response'::jsonb#>'{data,dueDate}'='null','explicit null clears due date');
SELECT public.test_assert(public.tasks_api_dispatch('tasks.update',jsonb_build_object('id',:'private_response'::jsonb#>>'{data,id}','expectedUpdatedAt',:'private_response'::jsonb#>>'{data,updatedAt}','patch','{"title":"stale"}'::jsonb),'20000000-0000-0000-0000-000000000001',NULL,'stale')#>>'{error,code}'='PRECONDITION_FAILED','stale timestamp cannot overwrite');
SELECT public.test_assert(public.tasks_api_dispatch('credentials.create','{"name":"API test","audience":"api","scopes":["tasks:read","tasks:create","tasks:update"],"tokenDigest":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}','20000000-0000-0000-0000-000000000001')->>'status'='201','self key creation');
SELECT public.test_assert(public.tasks_api_dispatch('tasks.list','{}',NULL,repeat('a',64))->>'status'='200','API credential grants resources');
SELECT public.test_assert(public.tasks_api_dispatch('mcp.exchange','{"sessionDigest":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"}',NULL,repeat('a',64))#>>'{error,code}'='INVALID_AUDIENCE','API key cannot exchange as MCP');
SELECT public.tasks_api_dispatch('credentials.create','{"name":"MCP test","audience":"mcp","scopes":["tasks:read","tasks:update"],"tokenDigest":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}','20000000-0000-0000-0000-000000000001') AS response \gset mcpkey_
SELECT public.test_assert(public.tasks_api_dispatch('tasks.list','{}',NULL,repeat('b',64))#>>'{error,code}'='INVALID_AUDIENCE','MCP secret cannot call resources');
SELECT public.test_assert(public.tasks_api_dispatch('mcp.exchange','{"sessionDigest":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"}',NULL,repeat('b',64))->>'status'='201','MCP exchanges to API-only session');
SELECT public.test_assert(public.tasks_api_dispatch('tasks.list','{}',NULL,repeat('c',64))->>'status'='200','exchanged capability reads tasks');
SELECT public.test_assert(public.tasks_api_dispatch('tasks.create','{"title":"scope blocked"}',NULL,repeat('c',64),'scope-denial')#>>'{error,code}'='INSUFFICIENT_SCOPE','session retains scope intersection');
SELECT public.test_assert(public.tasks_api_dispatch('credentials.revoke',jsonb_build_object('id',:'mcpkey_response'::jsonb#>>'{data,id}'),'20000000-0000-0000-0000-000000000002')#>>'{error,code}'='NOT_FOUND','cannot revoke someone else key');
SELECT public.tasks_api_dispatch('credentials.revoke',jsonb_build_object('id',:'mcpkey_response'::jsonb#>>'{data,id}'),'20000000-0000-0000-0000-000000000001');
SELECT public.test_assert(public.tasks_api_dispatch('tasks.list','{}',NULL,repeat('c',64))#>>'{error,code}'='INVALID_CREDENTIAL','parent revocation live after exchange');
RESET ROLE;
UPDATE public.omnia_users SET active=false WHERE id='10000000-0000-0000-0000-000000000003';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000003',false);
SELECT set_config('request.jwt.claim.role','authenticated',false);
DO $$ BEGIN BEGIN UPDATE public.omnia_users SET active=true WHERE auth_user_id=auth.uid(); RAISE EXCEPTION 'disabled admin can reactivate self'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
RESET ROLE;
UPDATE public.omnia_users SET active=true WHERE id='10000000-0000-0000-0000-000000000003';
UPDATE public.omnia_users SET active=false WHERE id='10000000-0000-0000-0000-000000000001';
SET ROLE service_role;
SELECT public.test_assert(public.tasks_api_dispatch('tasks.list','{}',NULL,repeat('a',64))#>>'{error,code}'='ACTOR_DISABLED','live disabled user loses access');
RESET ROLE;
UPDATE public.omnia_users SET active=true WHERE id='10000000-0000-0000-0000-000000000001';
INSERT INTO public.omnia_user_permissions(user_id,menu_item_id,can_access) VALUES ('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',false);
SET ROLE service_role;
SELECT public.test_assert(public.tasks_api_dispatch('tasks.create','{"title":"Private Alice","isPrivate":true,"statusId":"40000000-0000-0000-0000-000000000001","dueDate":"2026-10-05","ticketOcta":"external-9"}',NULL,repeat('a',64),'create-private')#>>'{error,code}'='FORBIDDEN','live denied override checked before replay');
SELECT public.test_assert(public.tasks_api_dispatch('credentials.list','{}','20000000-0000-0000-0000-000000000001')->>'status'='200','own keys manageable without task menu');
RESET ROLE;
DELETE FROM public.omnia_user_permissions;
-- Direct low privilege writes must obey RLS and cannot escalate profile authorization.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',false);
SELECT set_config('request.jwt.claim.role','authenticated',false);
DO $$ BEGIN BEGIN UPDATE public.omnia_users SET roles=ARRAY['ADMIN'] WHERE auth_user_id=auth.uid(); RAISE EXCEPTION 'profile escalation allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
SELECT public.test_assert(NOT EXISTS(SELECT 1 FROM public.omnia_tickets WHERE is_private),'real authenticated RLS hides Alice private task');
DO $$ BEGIN BEGIN PERFORM public.tasks_api_dispatch('tasks.list','{}',auth.uid()); RAISE EXCEPTION 'direct public RPC allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
RESET ROLE;
SELECT public.test_assert(NOT (SELECT rolbypassrls OR rolcanlogin FROM pg_roles WHERE rolname='omnia_tasks_worker'),'worker cannot login or bypass RLS');
SELECT public.test_assert(NOT pg_has_role('omnia_tasks_worker','authenticated','MEMBER'),'worker has no broad authenticated membership');
SELECT public.test_assert(NOT (SELECT rolinherit FROM pg_roles WHERE rolname='omnia_tasks_worker'),'worker does not inherit roles');
SELECT public.test_assert(NOT has_schema_privilege('omnia_tasks_worker','auth','USAGE'),'worker policies use resolved auth helpers without managed schema grants');
SELECT public.test_assert(NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_roles r ON r.oid=c.relowner WHERE r.rolname='omnia_tasks_worker' AND c.relkind='r'),'worker owns no table');
SET ROLE service_role;
SELECT public.test_assert(public.tasks_api_dispatch('unknown.operation','{}','20000000-0000-0000-0000-000000000001')#>>'{error,code}'='INVALID_OPERATION','finite operation allowlist');
SELECT public.test_assert(public.tasks_api_dispatch('tasks.list','{}','20000000-0000-0000-0000-000000000001',repeat('a',64))#>>'{error,code}'='INVALID_AUTH','exactly one verified identity');
SELECT public.test_assert(public.tasks_api_dispatch('tasks.list','{"limit":101}','20000000-0000-0000-0000-000000000001')#>>'{error,code}'='VALIDATION_ERROR','bounded pagination');
SELECT public.tasks_api_dispatch('tasks.create','{"title":"Public Alice","statusId":"40000000-0000-0000-0000-000000000001"}','20000000-0000-0000-0000-000000000001',NULL,'public-create') AS response \gset public_
SELECT public.tasks_api_dispatch('tasks.update',jsonb_build_object('id',:'public_response'::jsonb#>>'{data,id}','expectedUpdatedAt',:'public_response'::jsonb#>>'{data,updatedAt}','patch',jsonb_build_object('assignedToId','10000000-0000-0000-0000-000000000002')),'20000000-0000-0000-0000-000000000001',NULL,'assign-bob') AS response \gset assigned_
SELECT public.test_assert(:'assigned_response'::jsonb#>>'{data,assignedTo,name}'='Bob' AND :'assigned_response'::jsonb#>>'{data,createdBy,name}'='Alice','safe user refs included');
RESET ROLE;
SELECT public.test_assert(EXISTS(SELECT 1 FROM public.omnia_notifications WHERE ticket_id=(:'public_response'::jsonb#>>'{data,id}')::uuid AND created_by='10000000-0000-0000-0000-000000000001'),'assignment trigger derives actor');
SET ROLE service_role;
SELECT public.tasks_api_dispatch('tasks.create','{"title":"Recurring Alice","isPrivate":true,"recurrence":{"frequency":"DAILY","interval":1,"startDate":"2026-10-04","endType":"AFTER_COUNT","occurrenceLimit":3,"isActive":true}}','20000000-0000-0000-0000-000000000001',NULL,'rec-create') AS response \gset recurring_
SELECT public.test_assert(:'recurring_response'::jsonb->>'status'='201' AND :'recurring_response'::jsonb#>>'{data,recurrence,generatedOccurrences}'='1','human recurrence creates atomic first occurrence');
SELECT public.tasks_api_dispatch('tasks.create','{"title":"Unrelated recurrence","recurrence":{"frequency":"DAILY","interval":1,"startDate":"2020-01-01","endType":"NEVER"}}','20000000-0000-0000-0000-000000000001',NULL,'rec-other') AS response \gset unrelated_
SELECT public.tasks_api_dispatch('tasks.update',jsonb_build_object('id',:'recurring_response'::jsonb#>>'{data,id}','expectedUpdatedAt',:'recurring_response'::jsonb#>>'{data,updatedAt}','patch',jsonb_build_object('statusId','40000000-0000-0000-0000-000000000002')),'20000000-0000-0000-0000-000000000001',NULL,'rec-complete') AS response \gset completed_
SELECT public.test_assert(:'completed_response'::jsonb->>'status'='200' AND :'completed_response'::jsonb#>>'{data,recurrence,generatedOccurrences}'='2','completion creates only next occurrence');
SELECT public.tasks_api_dispatch('tasks.update',jsonb_build_object('id',:'completed_response'::jsonb#>>'{data,id}','expectedUpdatedAt',:'completed_response'::jsonb#>>'{data,updatedAt}','patch',jsonb_build_object('statusId','40000000-0000-0000-0000-000000000001')),'20000000-0000-0000-0000-000000000001',NULL,'rec-reopen') AS response \gset reopened_
SELECT public.tasks_api_dispatch('tasks.update',jsonb_build_object('id',:'reopened_response'::jsonb#>>'{data,id}','expectedUpdatedAt',:'reopened_response'::jsonb#>>'{data,updatedAt}','patch',jsonb_build_object('statusId','40000000-0000-0000-0000-000000000002')),'20000000-0000-0000-0000-000000000001',NULL,'rec-recomplete') AS response \gset recompleted_
SELECT public.test_assert(:'recompleted_response'::jsonb#>>'{data,recurrence,generatedOccurrences}'='2','reopening never advances generation again');
SELECT public.test_assert(public.tasks_api_dispatch('tasks.create','{"title":"Integration series","recurrence":{"frequency":"DAILY"}}',NULL,repeat('a',64),'integration-series')#>>'{error,code}'='FORBIDDEN','integration recurrence configuration forbidden');
SELECT public.test_assert(public.tasks_api_dispatch('tasks.create','{"title":"Injected counter","recurrence":{"frequency":"DAILY","generatedOccurrences":100}}','20000000-0000-0000-0000-000000000001',NULL,'counter')#>>'{error,code}'='VALIDATION_ERROR','derived series state forbidden');
SELECT public.test_assert(public.tasks_api_dispatch('tasks.create','{"title":"Invalid assignee","assignedToId":"ffffffff-ffff-ffff-ffff-ffffffffffff"}','20000000-0000-0000-0000-000000000001',NULL,'invalid-ref')#>>'{error,code}'='VALIDATION_ERROR','invalid references rejected');
SELECT public.tasks_api_dispatch('tasks.list','{"limit":1}','20000000-0000-0000-0000-000000000001') AS response \gset page_
SELECT public.test_assert(jsonb_array_length(:'page_response'::jsonb#>'{data,items}')=1 AND :'page_response'::jsonb#>'{data,nextCursor}'<>'null'::jsonb,'page returns bounded items and cursor');
SELECT public.tasks_api_dispatch('tasks.list',jsonb_build_object('limit',1,'cursor',:'page_response'::jsonb#>'{data,nextCursor}'),'20000000-0000-0000-0000-000000000001') AS response \gset page2_
SELECT public.test_assert(:'page_response'::jsonb#>>'{data,items,0,id}'<>:'page2_response'::jsonb#>>'{data,items,0,id}','cursor advances without duplicate');
RESET ROLE;
SELECT public.test_assert((SELECT generated_occurrences FROM public.omnia_ticket_recurrences WHERE id=(:'unrelated_response'::jsonb#>>'{data,recurrenceId}')::uuid)=1,'completion untouched unrelated overdue series');
SELECT public.test_assert(NOT EXISTS(SELECT 1 FROM public.omnia_tickets WHERE title IN ('Integration series','Injected counter','Invalid assignee')),'rejected writes rollback');
UPDATE tasks_api_private.credentials SET expires_at=now()-interval '1 second' WHERE token_digest=repeat('a',64);
SET ROLE service_role;
SELECT public.test_assert(public.tasks_api_dispatch('tasks.list','{}',NULL,repeat('a',64))#>>'{error,code}'='INVALID_CREDENTIAL','expired key rejected');
RESET ROLE;
UPDATE tasks_api_private.credentials SET expires_at=now()+interval '1 day' WHERE token_digest=repeat('a',64);
INSERT INTO tasks_api_private.rate_limits(actor_id,window_start,requests) VALUES ('10000000-0000-0000-0000-000000000001',date_trunc('minute',now()),120) ON CONFLICT(actor_id,window_start) DO UPDATE SET requests=120;
SET ROLE service_role;
SELECT public.test_assert(public.tasks_api_dispatch('tasks.list','{}',NULL,repeat('a',64))#>>'{error,code}'='RATE_LIMITED','persisted rate budget enforced');
RESET ROLE;
SELECT public.test_assert(NOT has_schema_privilege('authenticated','tasks_api_private','USAGE'),'private schema inaccessible');
DELETE FROM tasks_api_private.rate_limits;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',false);
SELECT set_config('request.jwt.claim.role','service_role',false);
-- The SQL role, not a caller-editable GUC, protects profile authorization fields.
DO $$ DECLARE n integer; BEGIN BEGIN UPDATE public.omnia_users SET active=false WHERE auth_user_id=auth.uid(); GET DIAGNOSTICS n=ROW_COUNT; IF n>0 THEN RAISE EXCEPTION 'profile active manipulation allowed'; END IF; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
SELECT set_config('request.jwt.claim.role','authenticated',false);
DO $$ BEGIN BEGIN UPDATE public.omnia_users SET auth_user_id='ffffffff-ffff-ffff-ffff-ffffffffffff' WHERE auth_user_id=auth.uid(); RAISE EXCEPTION 'profile auth relink allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
DO $$ BEGIN BEGIN INSERT INTO public.omnia_users(auth_user_id,name,email,roles) VALUES(auth.uid(),'Escalated','bad@example.test',ARRAY['ADMIN']); RAISE EXCEPTION 'profile insert escalation allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
DO $$ BEGIN BEGIN PERFORM public.generate_omnia_ticket_recurrences(current_date); RAISE EXCEPTION 'global generator exposed to human'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
RESET ROLE;
SET ROLE service_role;
SELECT public.test_assert(public.tasks_api_dispatch('statuses.list','{}','20000000-0000-0000-0000-000000000001')->>'status'='200','statuses operation works');
SELECT public.test_assert(jsonb_array_length(public.tasks_api_dispatch('assignees.list','{"query":"Bob"}','20000000-0000-0000-0000-000000000001')->'data')=1,'eligible assignees query works');
SELECT public.test_assert(public.tasks_api_dispatch('tasks.create','{"title":"Private assign denied","isPrivate":true,"assignedToId":"10000000-0000-0000-0000-000000000002"}','20000000-0000-0000-0000-000000000001',NULL,'private-assignee')#>>'{error,code}'='FORBIDDEN','private task assignee null or creator unless admin');
SELECT public.test_assert(public.tasks_api_dispatch('tasks.create','{"title":"Invalid date","dueDate":"2026-02-30"}','20000000-0000-0000-0000-000000000001',NULL,'date')#>>'{error,code}'='VALIDATION_ERROR','invalid calendar date rejected');
SELECT public.test_assert(public.tasks_api_dispatch('tasks.update',jsonb_build_object('id',:'assigned_response'::jsonb#>>'{data,id}','expectedUpdatedAt',:'assigned_response'::jsonb#>>'{data,updatedAt}','patch',jsonb_build_object('commentCount',10)),'20000000-0000-0000-0000-000000000001',NULL,'counter-write')#>>'{error,code}'='VALIDATION_ERROR','task counters not writable');
SELECT public.test_assert(public.tasks_api_dispatch('tasks.update',jsonb_build_object('id',:'assigned_response'::jsonb#>>'{data,id}','expectedUpdatedAt',:'assigned_response'::jsonb#>>'{data,updatedAt}','patch',jsonb_build_object('description','rolled back','recurrence',jsonb_build_object('frequency','UNKNOWN'))),'20000000-0000-0000-0000-000000000001',NULL,'rollback-patch')#>>'{error,code}'='VALIDATION_ERROR','recurrence validation failure after update reported');
SELECT public.test_assert(auth.uid()='20000000-0000-0000-0000-000000000002' AND auth.role()='authenticated','failure restores both legacy claim settings');
RESET ROLE;
SELECT public.test_assert((SELECT description IS NULL FROM public.omnia_tickets WHERE id=(:'assigned_response'::jsonb#>>'{data,id}')::uuid),'failed human recurrence patch rolls back task write');
SELECT public.test_assert(NOT EXISTS(SELECT 1 FROM tasks_api_private.idempotency WHERE key='rollback-patch'),'failed update creates no idempotency record');
UPDATE public.omnia_users SET active=false WHERE id='10000000-0000-0000-0000-000000000002';
SET ROLE service_role;
SELECT public.test_assert(jsonb_array_length(public.tasks_api_dispatch('assignees.list','{"query":"Bob"}','20000000-0000-0000-0000-000000000001')->'data')=0,'disabled assignee excluded');
SELECT public.test_assert(public.tasks_api_dispatch('tasks.get',jsonb_build_object('id',:'assigned_response'::jsonb#>>'{data,id}'),'20000000-0000-0000-0000-000000000001')#>>'{data,assignedTo,name}'='Bob','inactive user display ref retained');
RESET ROLE;
UPDATE public.omnia_users SET active=true WHERE id='10000000-0000-0000-0000-000000000002';
SELECT public.test_assert((SELECT expires_at-created_at BETWEEN interval '89 days 23 hours' AND interval '90 days 1 hour' FROM tasks_api_private.credentials WHERE token_digest=repeat('b',64)),'default key expiration is ninety days');
SELECT public.test_assert((SELECT expires_at-created_at<=interval '15 minutes 1 second' FROM tasks_api_private.sessions WHERE token_digest=repeat('c',64)),'MCP API capability expires within fifteen minutes');
SELECT public.test_assert((SELECT count(*) FROM tasks_api_private.audit WHERE operation='tasks.create' AND resource_id=(:'private_response'::jsonb#>>'{data,id}')::uuid)=1,'idempotent write emits one audit record');
SELECT id,updated_at FROM public.omnia_tickets WHERE recurrence_id=(:'recurring_response'::jsonb#>>'{data,recurrenceId}')::uuid AND recurrence_occurrence=2 \gset second_
SET ROLE service_role;
SELECT public.tasks_api_dispatch('tasks.update',jsonb_build_object('id',:'second_id','expectedUpdatedAt',:'second_updated_at','patch',jsonb_build_object('statusId','40000000-0000-0000-0000-000000000002')),NULL,repeat('a',64),'integration-complete') AS response \gset integrationcompleted_
SELECT public.test_assert(:'integrationcompleted_response'::jsonb#>>'{data,recurrence,generatedOccurrences}'='3' AND :'integrationcompleted_response'::jsonb#>>'{data,recurrence,isActive}'='false','integration can complete occurrence without configuring series');
SELECT public.tasks_api_dispatch('tasks.update',jsonb_build_object('id',:'recompleted_response'::jsonb#>>'{data,id}','expectedUpdatedAt',:'recompleted_response'::jsonb#>>'{data,updatedAt}','patch',jsonb_build_object('recurrence',jsonb_build_object('frequency','WEEKLY','interval',2,'startDate','2026-10-04','endType','AFTER_COUNT','occurrenceLimit',4,'isActive',true))),'20000000-0000-0000-0000-000000000001',NULL,'human-edit-series') AS response \gset seriesedited_
SELECT public.test_assert(:'seriesedited_response'::jsonb#>>'{data,recurrence,frequency}'='WEEKLY' AND :'seriesedited_response'::jsonb#>>'{data,recurrence,generatedOccurrences}'='3','human edit preserves generated state');
RESET ROLE;
SET ROLE authenticated;
SELECT public.test_assert(NOT EXISTS(SELECT 1 FROM public.omnia_ticket_recurrences WHERE is_private),'private recurrence config hidden from another user');
RESET ROLE;
SET ROLE service_role;
SELECT public.test_assert(public.generate_omnia_ticket_recurrences('2020-01-03')=2,'service cron signature generates overdue occurrences through shared helper');
RESET ROLE;
SELECT public.test_assert((SELECT generated_occurrences FROM public.omnia_ticket_recurrences WHERE id=(:'unrelated_response'::jsonb#>>'{data,recurrenceId}')::uuid)=3,'cron retains generation and deduplication');
SELECT public.test_assert(NOT EXISTS(SELECT 1 FROM tasks_api_private.audit WHERE operation='tasks.update' AND resource_id=(:'assigned_response'::jsonb#>>'{data,id}')::uuid AND request_id IS NULL),'audit includes request identity');
SET ROLE service_role;
SELECT public.tasks_api_dispatch('tasks.create','{"title":"Public replay access"}','20000000-0000-0000-0000-000000000001',NULL,'replay-access-create') AS response \gset accesscreated_
SELECT jsonb_build_object('id',:'accesscreated_response'::jsonb#>>'{data,id}','expectedUpdatedAt',:'accesscreated_response'::jsonb#>>'{data,updatedAt}','patch',jsonb_build_object('title','Bob public update')) AS payload \gset access_
SELECT public.tasks_api_dispatch('tasks.update',:'access_payload'::jsonb,'20000000-0000-0000-0000-000000000002',NULL,'bob-public-update') AS response \gset accessupdated_
SELECT public.tasks_api_dispatch('tasks.update',jsonb_build_object('id',:'accessupdated_response'::jsonb#>>'{data,id}','expectedUpdatedAt',:'accessupdated_response'::jsonb#>>'{data,updatedAt}','patch',jsonb_build_object('isPrivate',true)),'20000000-0000-0000-0000-000000000001',NULL,'alice-hide-task') AS response \gset accesshidden_
SELECT public.test_assert(:'accesshidden_response'::jsonb->>'status'='200','creator can make public task private');
SELECT public.test_assert(public.tasks_api_dispatch('tasks.update',:'access_payload'::jsonb,'20000000-0000-0000-0000-000000000002',NULL,'bob-public-update')#>>'{error,code}'='NOT_FOUND','idempotent retry rechecks current row visibility');
RESET ROLE;
