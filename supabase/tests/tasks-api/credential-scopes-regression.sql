\set ON_ERROR_STOP on
-- Editing the permissions of an active key, in the isolated fixture; rolls back completely.
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
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
SELECT set_config('request.jwt.claim.role','service_role',true);
SELECT set_config('request.jwt.claims','{"role":"service_role","sub":"20000000-0000-0000-0000-000000000001"}',true);

SELECT public.t_as(1,'credentials.create',jsonb_build_object('name','editable','audience','api','scopes','["tasks:read"]'::jsonb,'tokenDigest',repeat('f1',32),'expiresAt',NULL)) AS r \gset k_
SELECT public.t_as(1,'tasks.create','{"title":"scope target"}','sc-target') AS r \gset t_
SELECT public.test_assert(public.t_key(repeat('f1',32),'tasks.delete',jsonb_build_object('id',:'t_r'::jsonb#>>'{data,id}'))#>>'{error,code}'='INSUFFICIENT_SCOPE','baseline: a read-only key cannot delete');

-- Widening: the same secret gains the permission, keeps its expiry, and works on the next request.
SELECT public.t_as(1,'credentials.update',jsonb_build_object('id',:'k_r'::jsonb#>>'{data,id}','scopes','["tasks:read","tasks:delete"]'::jsonb)) AS r \gset up_
SELECT public.test_assert(:'up_r'::jsonb->>'status'='200' AND :'up_r'::jsonb#>'{data,scopes}'='["tasks:delete","tasks:read"]'::jsonb,'the owner adds a permission to an active key');
SELECT public.test_assert(:'up_r'::jsonb#>>'{data,revokedAt}' IS NULL AND :'up_r'::jsonb#>>'{data,expiresAt}' IS NULL AND :'up_r'::jsonb#>>'{data,id}'=:'k_r'::jsonb#>>'{data,id}','the key is neither revoked nor re-issued and keeps its expiry');
SELECT public.test_assert(public.t_key(repeat('f1',32),'tasks.delete',jsonb_build_object('id',:'t_r'::jsonb#>>'{data,id}'))->>'status'='200','the same secret now deletes');

-- Narrowing applies on the very next request.
SELECT public.t_as(1,'credentials.update',jsonb_build_object('id',:'k_r'::jsonb#>>'{data,id}','scopes','["tasks:create"]'::jsonb)) AS r \gset down_
SELECT public.test_assert(public.t_key(repeat('f1',32),'tasks.list','{}')#>>'{error,code}'='INSUFFICIENT_SCOPE','a removed permission stops working at once');

-- An MCP key: an open session is narrowed at once too, because the key scopes are checked with it.
SELECT public.t_as(1,'credentials.create',jsonb_build_object('name','mcp editable','audience','mcp','scopes','["tasks:read"]'::jsonb,'tokenDigest',repeat('f2',32))) AS r \gset m_
SELECT public.test_assert(public.t_key(repeat('f2',32),'mcp.exchange',jsonb_build_object('sessionDigest',repeat('f3',32)))->>'status'='201','baseline: the MCP key opens a session');
SELECT public.test_assert(public.t_key(repeat('f3',32),'tasks.list','{}')->>'status'='200','baseline: the session reads');
SELECT public.t_as(1,'credentials.update',jsonb_build_object('id',:'m_r'::jsonb#>>'{data,id}','scopes','["tasks:create"]'::jsonb)) AS r \gset mdown_
SELECT public.test_assert(public.t_key(repeat('f3',32),'tasks.list','{}')#>>'{error,code}'='INSUFFICIENT_SCOPE','narrowing the key cuts an already open MCP session');

-- Ownership, validation and audience.
SELECT public.test_assert(public.t_as(2,'credentials.update',jsonb_build_object('id',:'k_r'::jsonb#>>'{data,id}','scopes','["tasks:read"]'::jsonb))#>>'{error,code}'='NOT_FOUND','another user cannot edit the key');
SELECT public.test_assert(public.t_key(repeat('f1',32),'credentials.update',jsonb_build_object('id',:'k_r'::jsonb#>>'{data,id}','scopes','["tasks:read","tasks:create","tasks:update","tasks:comment","tasks:delete"]'::jsonb))#>>'{error,code}'='FORBIDDEN','a key can never edit permissions, not even its own');
SELECT public.test_assert(public.t_as(1,'credentials.update',jsonb_build_object('id',:'k_r'::jsonb#>>'{data,id}','scopes','[]'::jsonb))#>>'{error,code}'='VALIDATION_ERROR','an empty permission list is rejected');
SELECT public.test_assert(public.t_as(1,'credentials.update',jsonb_build_object('id',:'k_r'::jsonb#>>'{data,id}','scopes','["tasks:admin"]'::jsonb))#>>'{error,code}'='VALIDATION_ERROR','an unknown permission is rejected');
SELECT public.test_assert(public.t_as(1,'credentials.update',jsonb_build_object('id',:'k_r'::jsonb#>>'{data,id}','scopes','["tasks:read"]'::jsonb,'name','x'))#>>'{error,code}'='VALIDATION_ERROR','only the permissions can be edited');
SELECT public.t_as(1,'credentials.revoke',jsonb_build_object('id',:'k_r'::jsonb#>>'{data,id}')) AS r \gset rv_
SELECT public.test_assert(public.t_as(1,'credentials.update',jsonb_build_object('id',:'k_r'::jsonb#>>'{data,id}','scopes','["tasks:read"]'::jsonb))#>>'{error,code}'='NOT_FOUND','a revoked key cannot be edited back to life');

RESET ROLE;
SELECT public.test_assert((SELECT count(*) FROM tasks_api_private.audit WHERE operation='credentials.update')=3,'each successful edit is audited');
ROLLBACK;
SELECT 'credential scopes regression passed' AS result;
