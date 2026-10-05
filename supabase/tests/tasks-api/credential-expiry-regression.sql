\set ON_ERROR_STOP on
-- Key lifetime: omitted expiresAt keeps the 90-day default, an explicit instant is honoured within
-- its bounds, and an explicit null means the key never expires (until revoked). Rolls back.
CREATE OR REPLACE FUNCTION public.test_assert(condition boolean, label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF condition IS DISTINCT FROM true THEN RAISE EXCEPTION 'Assertion failed: %',label; END IF; END $$;
CREATE OR REPLACE FUNCTION public.t_as(n integer, op text, payload jsonb, key text DEFAULT NULL) RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.tasks_api_dispatch(op,payload,('20000000-0000-0000-0000-00000000000'||n)::uuid,NULL,key)
$$;
CREATE OR REPLACE FUNCTION public.t_key(digest text, op text, payload jsonb, key text DEFAULT NULL) RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.tasks_api_dispatch(op,payload,NULL,digest,key)
$$;
CREATE OR REPLACE FUNCTION public.t_days(ts text) RETURNS numeric LANGUAGE sql AS $$
  SELECT extract(epoch FROM (ts::timestamptz - clock_timestamp()))/86400
$$;

BEGIN;
DELETE FROM tasks_api_private.rate_limits;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000003',true);
SELECT set_config('request.jwt.claim.role','service_role',true);
SELECT set_config('request.jwt.claims','{"role":"service_role","sub":"20000000-0000-0000-0000-000000000003"}',true);

-- Default and bounded explicit lifetimes are unchanged.
SELECT public.t_as(1,'credentials.create',jsonb_build_object('name','default','audience','api','scopes','["tasks:read"]'::jsonb,'tokenDigest',repeat('a1',32))) AS r \gset def_
SELECT public.test_assert(:'def_r'::jsonb->>'status'='201' AND public.t_days(:'def_r'::jsonb#>>'{data,expiresAt}') BETWEEN 89.9 AND 90.1,'omitted expiresAt keeps the 90-day default');
SELECT public.t_as(1,'credentials.create',jsonb_build_object('name','7d','audience','api','scopes','["tasks:read"]'::jsonb,'tokenDigest',repeat('a2',32),'expiresAt',to_char(clock_timestamp()+interval '7 days','YYYY-MM-DD"T"HH24:MI:SS.US"+00:00"'))) AS r \gset d7_
SELECT public.test_assert(:'d7_r'::jsonb->>'status'='201' AND public.t_days(:'d7_r'::jsonb#>>'{data,expiresAt}') BETWEEN 6.9 AND 7.1,'explicit 7-day lifetime accepted');
SELECT public.test_assert(public.t_as(1,'credentials.create',jsonb_build_object('name','past','audience','api','scopes','["tasks:read"]'::jsonb,'tokenDigest',repeat('a3',32),'expiresAt',to_char(clock_timestamp()-interval '1 minute','YYYY-MM-DD"T"HH24:MI:SS.US"+00:00"')))#>>'{error,code}'='VALIDATION_ERROR','a past expiry is rejected');
SELECT public.test_assert(public.t_as(1,'credentials.create',jsonb_build_object('name','far','audience','api','scopes','["tasks:read"]'::jsonb,'tokenDigest',repeat('a4',32),'expiresAt',to_char(clock_timestamp()+interval '366 days','YYYY-MM-DD"T"HH24:MI:SS.US"+00:00"')))#>>'{error,code}'='VALIDATION_ERROR','an expiry beyond 365 days is rejected');
SELECT public.test_assert(public.t_as(1,'credentials.create',jsonb_build_object('name','num','audience','api','scopes','["tasks:read"]'::jsonb,'tokenDigest',repeat('a5',32),'expiresAt',12345))#>>'{error,code}'='VALIDATION_ERROR','a non-string expiry is rejected');

-- Explicit null: never expires.
SELECT public.t_as(1,'credentials.create',jsonb_build_object('name','forever','audience','api','scopes','["tasks:read"]'::jsonb,'tokenDigest',repeat('b1',32),'expiresAt',NULL::text)) AS r \gset never_
SELECT public.test_assert(:'never_r'::jsonb->>'status'='201' AND :'never_r'::jsonb#>'{data,expiresAt}'='null'::jsonb,'explicit null creates a key without expiry');
RESET ROLE;
SELECT public.test_assert((SELECT expires_at IS NULL FROM tasks_api_private.credentials WHERE token_digest=repeat('b1',32)),'the database stores no expiry for it');
UPDATE tasks_api_private.credentials SET created_at=now()-interval '3 years' WHERE token_digest=repeat('b1',32);
SET LOCAL ROLE service_role;
SELECT public.test_assert(public.t_key(repeat('b1',32),'tasks.list','{}')->>'status'='200','a key without expiry authenticates, even years after creation');
SELECT public.test_assert(EXISTS(SELECT 1 FROM jsonb_array_elements(public.t_as(1,'credentials.list','{}')->'data') e WHERE e->>'name'='forever' AND e->'expiresAt'='null'::jsonb),'listing reports a missing expiry as null');

-- MCP: the exchanged capability stays short-lived even when its parent never expires.
SELECT public.test_assert(public.t_as(1,'credentials.create',jsonb_build_object('name','forever-mcp','audience','mcp','scopes','["tasks:read"]'::jsonb,'tokenDigest',repeat('b2',32),'expiresAt',NULL::text))->>'status'='201','a never-expiring MCP key can be issued');
SELECT public.t_key(repeat('b2',32),'mcp.exchange',jsonb_build_object('sessionDigest',repeat('b3',32))) AS r \gset ex_
SELECT public.test_assert(:'ex_r'::jsonb->>'status'='201' AND public.t_days(:'ex_r'::jsonb#>>'{data,expiresAt}') BETWEEN 0 AND 0.0108,'the capability still expires within 15 minutes');
SELECT public.test_assert(public.t_key(repeat('b3',32),'tasks.list','{}')->>'status'='200','the capability works');

-- Revocation is the way out for a key without expiry.
SELECT public.test_assert(public.t_as(1,'credentials.revoke',jsonb_build_object('id',:'never_r'::jsonb#>>'{data,id}'))->>'status'='200','the owner revokes a key without expiry');
SELECT public.test_assert(public.t_key(repeat('b1',32),'tasks.list','{}')#>>'{error,code}'='INVALID_CREDENTIAL','a revoked key without expiry stops working');

-- Finite keys still expire.
RESET ROLE;
UPDATE tasks_api_private.credentials SET expires_at=now()-interval '1 second' WHERE token_digest=repeat('a2',32);
SET LOCAL ROLE service_role;
SELECT public.test_assert(public.t_key(repeat('a2',32),'tasks.list','{}')#>>'{error,code}'='INVALID_CREDENTIAL','a finite key rejects after its expiry');
SELECT public.test_assert(public.t_key(repeat('a1',32),'tasks.list','{}')->>'status'='200','a finite key inside its lifetime still works');
ROLLBACK;
SELECT 'credential expiry regression passed' AS result;
