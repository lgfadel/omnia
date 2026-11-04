\set ON_ERROR_STOP on
-- Balancete and condominium lookup regressions run only in the isolated fixture and roll back completely.
-- Alice (USUARIO), Bob (USUARIO) and Admin (ADMIN) are 10000000-...-00N with auth ids 20000000-...-00N.
CREATE OR REPLACE FUNCTION public.test_assert(condition boolean, label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF condition IS DISTINCT FROM true THEN RAISE EXCEPTION 'Assertion failed: %',label; END IF; END $$;
CREATE OR REPLACE FUNCTION public.t_as(n integer, op text, payload jsonb, key text DEFAULT NULL) RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.tasks_api_dispatch(op,payload,('20000000-0000-0000-0000-00000000000'||n)::uuid,NULL,key)
$$;
CREATE OR REPLACE FUNCTION public.t_key(digest text, op text, payload jsonb, key text DEFAULT NULL) RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.tasks_api_dispatch(op,payload,NULL,digest,key)
$$;
-- The version a client would send back: the exact stored timestamp.
CREATE OR REPLACE FUNCTION public.t_up(n integer, r jsonb, patch jsonb, key text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.t_as(n,'balancetes.update',jsonb_build_object('id',r#>>'{data,id}','expectedUpdatedAt',r#>>'{data,updatedAt}','patch',patch),key)
$$;

BEGIN;
DELETE FROM tasks_api_private.rate_limits;
INSERT INTO public.omnia_condominiums(id,name,euro,balancete_digital,active,syndic_cpf) VALUES
 ('70000000-0000-0000-0000-000000000001','Edifício São João','Londrina',true,true,'11111111111'),
 ('70000000-0000-0000-0000-000000000002','Residencial Físico','Campinas',false,true,NULL),
 ('70000000-0000-0000-0000-000000000003','Condomínio Inativo','Londrina',false,false,NULL),
 ('70000000-0000-0000-0000-000000000004','Outro Digital','Londrina',true,NULL,NULL);
INSERT INTO public.omnia_condominium_aliases(condominium_id,alias_normalized,alias_original) VALUES ('70000000-0000-0000-0000-000000000002','COND FISICO LTDA','Cond Físico Ltda');
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
SELECT set_config('request.jwt.claim.role','service_role',true);
SELECT set_config('request.jwt.claims','{"role":"service_role","sub":"20000000-0000-0000-0000-000000000001"}',true);

-- Lookup: accent- and case-insensitive by name and alias, active only by default, personal data never returned.
SELECT public.test_assert(jsonb_array_length(public.t_as(1,'condominiums.list','{}')#>'{data,items}')=3 AND public.t_as(1,'condominiums.list','{}')#>>'{data,hasMore}'='false','the lookup lists active condominiums, treating a null active as active');
SELECT public.test_assert(jsonb_array_length(public.t_as(1,'condominiums.list','{"includeInactive":true}')#>'{data,items}')=4,'includeInactive also lists inactive ones');
SELECT public.test_assert(public.t_as(1,'condominiums.list','{"query":"sao JOAO"}')#>>'{data,items,0,id}'='70000000-0000-0000-0000-000000000001','the name search ignores accents and case');
SELECT public.test_assert(public.t_as(1,'condominiums.list','{"query":"cond físico"}')#>'{data,items,0}' @> '{"id":"70000000-0000-0000-0000-000000000002","aliases":["Cond Físico Ltda"],"euro":"Campinas","balanceteDigital":false}','an alias finds its condominium and is returned');
SELECT public.test_assert(jsonb_array_length(public.t_as(1,'condominiums.list','{"query":"100%"}')#>'{data,items}')=0,'a percent sign is a literal character, not a wildcard');
SELECT public.test_assert(public.t_as(1,'condominiums.list','{"limit":1}')#>>'{data,hasMore}'='true','hasMore reports a truncated page');
SELECT public.test_assert(public.t_as(1,'condominiums.list','{"limit":501}')#>>'{error,code}'='VALIDATION_ERROR','the limit is bounded');
SELECT public.test_assert(NOT public.t_as(1,'condominiums.list','{}')::text ~ '11111111111|syndicCpf','the lookup never carries the syndic CPF');
SELECT public.test_assert(NOT has_column_privilege('omnia_tasks_worker','public.omnia_condominiums','syndic_cpf','SELECT') AND NOT has_column_privilege('omnia_tasks_worker','public.omnia_condominiums','phone','SELECT') AND NOT has_column_privilege('omnia_tasks_worker','public.omnia_condominiums','address','SELECT') AND NOT has_table_privilege('omnia_tasks_worker','public.omnia_condominiums','UPDATE'),'the worker cannot read personal columns nor change a condominium');

-- Upsert parity with balanceteCsvImport.test.ts. Digital: creates with both dates.
SELECT public.t_as(1,'balancetes.upsert','{"condominiumId":"70000000-0000-0000-0000-000000000001","competencia":"01/2026","generatedAt":"2026-02-10T09:00:00-03:00"}','u1') AS r \gset d_
SELECT public.test_assert(:'d_r'::jsonb->>'status'='200' AND :'d_r'::jsonb#>'{data}' @> '{"action":"create","receivedAt":"2026-02-10","volumes":1,"competencia":"01/2026","createdById":"10000000-0000-0000-0000-000000000001","csvImportBatchId":null}','digital creates with received date and one volume');
-- Same instant written in another offset is the same instant: no write.
SELECT public.t_as(1,'balancetes.upsert','{"condominiumId":"70000000-0000-0000-0000-000000000001","competencia":"01/2026","generatedAt":"2026-02-10T12:00:00+00:00"}','u2') AS r \gset dn_
SELECT public.test_assert(:'dn_r'::jsonb#>>'{data,action}'='noop' AND :'dn_r'::jsonb#>>'{data,updatedAt}'=:'d_r'::jsonb#>>'{data,updatedAt}','the same instant is a noop that leaves the row version alone');
-- Digital with a newer date updates both dates.
SELECT public.t_as(1,'balancetes.upsert','{"condominiumId":"70000000-0000-0000-0000-000000000001","competencia":"01/2026","generatedAt":"2026-02-11T09:00:00-03:00"}','u3') AS r \gset du_
SELECT public.test_assert(:'du_r'::jsonb#>'{data}' @> '{"action":"update","receivedAt":"2026-02-11"}' AND :'du_r'::jsonb#>>'{data,id}'=:'d_r'::jsonb#>>'{data,id}','digital with a new date updates both dates on the same row');
-- A digital row whose received date drifted is repaired even with an identical instant.
RESET ROLE;
UPDATE public.omnia_balancetes SET received_at='2026-01-01' WHERE id=(:'d_r'::jsonb#>>'{data,id}')::uuid;
SET LOCAL ROLE service_role;
SELECT public.test_assert(public.t_as(1,'balancetes.upsert','{"condominiumId":"70000000-0000-0000-0000-000000000001","competencia":"01/2026","generatedAt":"2026-02-11T09:00:00-03:00"}','u4')#>'{data}' @> '{"action":"update","receivedAt":"2026-02-11"}','digital repairs a drifted received date');
-- Sao Paulo calendar: 01:30 UTC is still the previous evening in Brazil.
SELECT public.test_assert(public.t_as(1,'balancetes.upsert','{"condominiumId":"70000000-0000-0000-0000-000000000004","competencia":"01/2026","generatedAt":"2026-02-11T01:30:00Z"}','u5')#>>'{data,receivedAt}'='2026-02-10','the received date follows the Sao Paulo calendar');

-- Physical: the received date stays empty on create and untouched on update.
SELECT public.t_as(1,'balancetes.upsert','{"condominiumId":"70000000-0000-0000-0000-000000000002","competencia":"01/2026","generatedAt":"2026-02-10T09:00:00-03:00"}','p1') AS r \gset f_
SELECT public.test_assert(:'f_r'::jsonb#>'{data}' @> '{"action":"create","receivedAt":null}' AND :'f_r'::jsonb#>>'{data,digitalPreparedAt}' IS NOT NULL,'physical creates waiting for the book');
SELECT public.test_assert(public.t_as(1,'balancetes.upsert','{"condominiumId":"70000000-0000-0000-0000-000000000002","competencia":"01/2026","generatedAt":"2026-02-10T09:00:00-03:00"}','p2')#>>'{data,action}'='noop','physical with the same instant is a noop');
RESET ROLE;
UPDATE public.omnia_balancetes SET received_at='2026-02-20' WHERE id=(:'f_r'::jsonb#>>'{data,id}')::uuid;
SET LOCAL ROLE service_role;
SELECT public.test_assert(public.t_as(1,'balancetes.upsert','{"condominiumId":"70000000-0000-0000-0000-000000000002","competencia":"01/2026","generatedAt":"2026-02-12T09:00:00-03:00"}','p3')#>'{data}' @> '{"action":"update","receivedAt":"2026-02-20"}','physical update keeps a recorded received date');

-- Upsert refusals write nothing.
SELECT public.test_assert(public.t_as(1,'balancetes.upsert','{"condominiumId":"70000000-0000-0000-0000-000000000003","competencia":"01/2026","generatedAt":"2026-02-10T09:00:00-03:00"}','r1') #>>'{error,code}'='CONDOMINIUM_INACTIVE','an inactive condominium is refused');
SELECT public.test_assert(public.t_as(1,'balancetes.upsert','{"condominiumId":"7fffffff-0000-0000-0000-000000000003","competencia":"01/2026","generatedAt":"2026-02-10T09:00:00-03:00"}','r2')->>'status'='404','an unknown condominium is NOT_FOUND');
SELECT public.test_assert(public.t_as(1,'balancetes.upsert','{"condominiumId":"70000000-0000-0000-0000-000000000001","competencia":"2026-01","generatedAt":"2026-02-10T09:00:00-03:00"}','r3')#>>'{error,code}'='VALIDATION_ERROR','a competencia outside MM/YYYY is refused');
SELECT public.test_assert(public.t_as(1,'balancetes.upsert','{"condominiumId":"70000000-0000-0000-0000-000000000001","competencia":"13/2026","generatedAt":"2026-02-10T09:00:00-03:00"}','r4')#>>'{error,code}'='VALIDATION_ERROR','an impossible month is refused');
SELECT public.test_assert(public.t_as(1,'balancetes.upsert','{"condominiumId":"70000000-0000-0000-0000-000000000001","competencia":"01/2026","generatedAt":"ontem"}','r5')#>>'{error,code}'='VALIDATION_ERROR','an invalid time is refused');
SELECT public.test_assert(public.t_as(1,'balancetes.upsert','{"condominiumId":"70000000-0000-0000-0000-000000000001","competencia":"01/2026"}','r6')#>>'{error,code}'='VALIDATION_ERROR','the generation time is required');
SELECT public.test_assert(public.t_as(1,'balancetes.upsert','{"condominiumId":"70000000-0000-0000-0000-000000000001","competencia":"01/2026","generatedAt":"2026-02-10T09:00:00-03:00","volumes":3}','r7')#>>'{error,code}'='VALIDATION_ERROR','unknown fields are refused');
SELECT public.test_assert(public.t_as(1,'balancetes.upsert','{"condominiumId":"70000000-0000-0000-0000-000000000001","competencia":"01/2026","generatedAt":"2026-02-10T09:00:00-03:00"}')#>>'{error,code}'='VALIDATION_ERROR','the idempotency key is required');
-- A duplicated key is never guessed at, unlike the Map in the screen.
RESET ROLE;
INSERT INTO public.omnia_balancetes(condominium_id,competencia) VALUES ('70000000-0000-0000-0000-000000000004','05/2026'),('70000000-0000-0000-0000-000000000004','05/2026');
SET LOCAL ROLE service_role;
SELECT public.test_assert(public.t_as(1,'balancetes.upsert','{"condominiumId":"70000000-0000-0000-0000-000000000004","competencia":"05/2026","generatedAt":"2026-06-10T09:00:00-03:00"}','r8')#>>'{error,code}'='AMBIGUOUS_BALANCETE','a duplicated period is refused');
SELECT public.test_assert((SELECT count(*) FROM public.omnia_balancetes WHERE competencia='05/2026' AND digital_prepared_at IS NOT NULL)=0,'the refusal leaves both rows untouched');

-- Idempotency: replay returns the stored answer; another input under the same key conflicts.
SELECT public.test_assert(public.t_as(1,'balancetes.upsert','{"condominiumId":"70000000-0000-0000-0000-000000000001","competencia":"01/2026","generatedAt":"2026-02-10T09:00:00-03:00"}','u1')#>>'{data,action}'='create','a replay returns the first answer');
SELECT public.test_assert((SELECT count(*) FROM public.omnia_balancetes WHERE condominium_id='70000000-0000-0000-0000-000000000001')=1,'a replay does not write');
SELECT public.test_assert(public.t_as(1,'balancetes.upsert','{"condominiumId":"70000000-0000-0000-0000-000000000001","competencia":"02/2026","generatedAt":"2026-02-10T09:00:00-03:00"}','u1')#>>'{error,code}'='IDEMPOTENCY_CONFLICT','the same key with another input conflicts');

-- Reads.
SELECT public.t_as(1,'balancetes.get',jsonb_build_object('id',:'f_r'::jsonb#>>'{data,id}')) AS r \gset g_
SELECT public.test_assert(:'g_r'::jsonb#>'{data}' @> '{"condominiumName":"Residencial Físico","euro":"Campinas","balanceteDigital":false,"receivedAt":"2026-02-20"}','get returns the balancete with its condominium');
SELECT public.test_assert(public.t_as(1,'balancetes.get','{"id":"7fffffff-0000-0000-0000-000000000009"}')->>'status'='404','get of an unknown id is NOT_FOUND');
SELECT public.test_assert(jsonb_array_length(public.t_as(1,'balancetes.list','{"condominiumId":"70000000-0000-0000-0000-000000000002"}')#>'{data,items}')=1,'list filters by condominium');
SELECT public.test_assert(jsonb_array_length(public.t_as(1,'balancetes.list','{"euro":"Campinas","competencia":"01/2026"}')#>'{data,items}')=1 AND jsonb_array_length(public.t_as(1,'balancetes.list','{"euro":"Campinas","competencia":"02/2026"}')#>'{data,items}')=0,'list filters by office and period');
SELECT public.test_assert(public.t_as(1,'balancetes.list','{"competencia":"2026-01"}')#>>'{error,code}'='VALIDATION_ERROR','list validates the period');
SELECT public.t_as(1,'balancetes.list','{"limit":1}') AS r \gset page_
SELECT public.test_assert(jsonb_array_length(:'page_r'::jsonb#>'{data,items}')=1 AND :'page_r'::jsonb#>>'{data,nextCursor,id}' IS NOT NULL,'a short page returns a cursor');
SELECT public.test_assert(public.t_as(1,'balancetes.list',jsonb_build_object('limit',1,'cursor',:'page_r'::jsonb#>'{data,nextCursor}'))#>>'{data,items,0,id}'<>:'page_r'::jsonb#>>'{data,items,0,id}','the cursor advances');
SELECT public.t_as(1,'balancetes.upsert','{"condominiumId":"70000000-0000-0000-0000-000000000002","competencia":"03/2026","generatedAt":"2026-04-10T09:00:00-03:00"}','aw1') AS r \gset aw_
SELECT public.test_assert((public.t_as(1,'balancetes.list','{"awaitingPhysical":true}')#>'{data,items}') @> jsonb_build_array(jsonb_build_object('id',:'aw_r'::jsonb#>>'{data,id}')) AND NOT (public.t_as(1,'balancetes.list','{"awaitingPhysical":false}')#>'{data,items}') @> jsonb_build_array(jsonb_build_object('id',:'aw_r'::jsonb#>>'{data,id}')),'list filters what still waits for the book');

-- Update: version, fields and period rules.
SELECT public.t_as(1,'balancetes.get',jsonb_build_object('id',:'f_r'::jsonb#>>'{data,id}')) AS r \gset v1_
SELECT public.t_up(1,:'v1_r'::jsonb,'{"volumes":3,"observations":"caixa 2","receivedAt":"2026-02-21"}','e1') AS r \gset e1_
SELECT public.test_assert(:'e1_r'::jsonb#>'{data}' @> '{"volumes":3,"observations":"caixa 2","receivedAt":"2026-02-21"}','update changes the form fields');
SELECT public.test_assert(public.t_up(1,:'v1_r'::jsonb,'{"volumes":4}','e2')#>>'{error,code}'='BALANCETE_CHANGED','a stale version is refused');
SELECT public.test_assert((public.t_up(1,:'v1_r'::jsonb,'{"volumes":4}','e2')->>'status')='412','a stale version answers 412');
SELECT public.test_assert(public.t_as(1,'balancetes.update',jsonb_build_object('id',:'f_r'::jsonb#>>'{data,id}','patch','{"volumes":2}'::jsonb),'e3')->>'status'='428','the version is required');
SELECT public.test_assert(public.t_up(1,:'e1_r'::jsonb,'{}','e4')#>>'{error,code}'='VALIDATION_ERROR','an empty patch is refused');
SELECT public.test_assert(public.t_up(1,:'e1_r'::jsonb,'{"status":"enviado"}','e5')#>>'{error,code}'='VALIDATION_ERROR','derived fields cannot be patched');
SELECT public.test_assert(public.t_up(1,:'e1_r'::jsonb,'{"volumes":0}','e6')#>>'{error,code}'='VALIDATION_ERROR','volumes start at one');
SELECT public.test_assert(public.t_up(1,:'e1_r'::jsonb,'{"volumes":1.5}','e7')#>>'{error,code}'='VALIDATION_ERROR','volumes are whole numbers');
SELECT public.test_assert(public.t_up(1,:'e1_r'::jsonb,'{"receivedAt":null}','e8')#>>'{error,code}'='VALIDATION_ERROR','the received date cannot be cleared, like the form');
SELECT public.test_assert(public.t_up(1,:'e1_r'::jsonb,'{"receivedAt":"2026-02-30"}','e9')#>>'{error,code}'='VALIDATION_ERROR','an impossible date is refused');
SELECT public.t_as(1,'balancetes.get',jsonb_build_object('id',:'d_r'::jsonb#>>'{data,id}')) AS r \gset d2_
SELECT public.test_assert(public.t_up(1,:'d2_r'::jsonb,'{"volumes":2}','e11')#>>'{error,code}'='VALIDATION_ERROR','a digital balancete keeps one volume, like the form');
-- Moving: to a free period works, to a taken one conflicts, to an inactive condominium is refused.
SELECT public.test_assert(public.t_up(1,:'e1_r'::jsonb,'{"competencia":"03/2026"}','m1')#>>'{error,code}'='CONFLICT','a taken period conflicts');
SELECT public.test_assert(public.t_up(1,:'e1_r'::jsonb,'{"condominiumId":"70000000-0000-0000-0000-000000000003"}','m2')#>>'{error,code}'='CONDOMINIUM_INACTIVE','an inactive destination is refused');
SELECT public.test_assert(public.t_up(1,:'e1_r'::jsonb,'{"competencia":"02/2026"}','m3')#>>'{data,competencia}'='02/2026','a free period is accepted');
-- A sent balancete keeps condominium and period, but the other fields stay editable.
RESET ROLE;
INSERT INTO public.omnia_protocolos(id) VALUES ('80000000-0000-0000-0000-000000000001');
INSERT INTO public.omnia_balancetes(id,condominium_id,competencia,protocolo_id,sent_at,received_at) VALUES
 ('81000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000002','07/2026','80000000-0000-0000-0000-000000000001',now(),'2026-08-01'),
 ('81000000-0000-0000-0000-000000000002','70000000-0000-0000-0000-000000000002','08/2026',NULL,now(),'2026-09-01'),
 ('81000000-0000-0000-0000-000000000003','70000000-0000-0000-0000-000000000002','09/2026',NULL,NULL,'2026-10-01'),
 ('81000000-0000-0000-0000-000000000004','70000000-0000-0000-0000-000000000002','10/2026',NULL,NULL,'2026-11-01');
INSERT INTO public.omnia_balancete_attachments(balancete_id,name,url) VALUES ('81000000-0000-0000-0000-000000000003','a.pdf','https://example.test/a.pdf');
SET LOCAL ROLE service_role;
SELECT public.t_as(1,'balancetes.get','{"id":"81000000-0000-0000-0000-000000000001"}') AS r \gset s_
SELECT public.test_assert(public.t_up(1,:'s_r'::jsonb,'{"competencia":"11/2026"}','s1')#>>'{error,code}'='BALANCETE_LOCKED','a sent balancete keeps its period');
SELECT public.test_assert(public.t_up(1,:'s_r'::jsonb,'{"condominiumId":"70000000-0000-0000-0000-000000000004"}','s2')#>>'{error,code}'='BALANCETE_LOCKED','a sent balancete keeps its condominium');
SELECT public.test_assert(public.t_up(1,:'s_r'::jsonb,'{"observations":"ok","competencia":"07/2026"}','s3')#>>'{data,observations}'='ok','other fields stay editable, and repeating the same period is not a move');

-- Delete: nothing sent or carrying files goes away.
SELECT public.test_assert(public.t_as(1,'balancetes.delete','{"id":"81000000-0000-0000-0000-000000000001"}')#>>'{error,code}'='BALANCETE_LOCKED','a balancete with a protocol is kept');
SELECT public.test_assert(public.t_as(1,'balancetes.delete','{"id":"81000000-0000-0000-0000-000000000002"}')#>>'{error,code}'='BALANCETE_LOCKED','a balancete sent without a protocol is kept');
SELECT public.test_assert(public.t_as(1,'balancetes.delete','{"id":"81000000-0000-0000-0000-000000000003"}')#>>'{error,code}'='BALANCETE_LOCKED','a balancete with attachments is kept');
SELECT public.test_assert(public.t_as(1,'balancetes.delete','{"id":"81000000-0000-0000-0000-000000000004"}')#>'{data}' @> '{"id":"81000000-0000-0000-0000-000000000004","competencia":"10/2026"}','a free balancete is deleted and returned');
SELECT public.test_assert(NOT EXISTS(SELECT 1 FROM public.omnia_balancetes WHERE id='81000000-0000-0000-0000-000000000004'),'the row is gone');
SELECT public.test_assert(public.t_as(1,'balancetes.delete','{"id":"81000000-0000-0000-0000-000000000004"}')->>'status'='404','a repeated delete answers NOT_FOUND');
-- A replay after the delete reports the absence instead of a stale success.
SELECT public.t_as(1,'balancetes.upsert','{"condominiumId":"70000000-0000-0000-0000-000000000004","competencia":"12/2026","generatedAt":"2027-01-10T09:00:00-03:00"}','gone') AS r \gset gn_
SELECT public.t_as(1,'balancetes.delete',jsonb_build_object('id',:'gn_r'::jsonb#>>'{data,id}')) AS r \gset gd_
SELECT public.test_assert(public.t_as(1,'balancetes.upsert','{"condominiumId":"70000000-0000-0000-0000-000000000004","competencia":"12/2026","generatedAt":"2027-01-10T09:00:00-03:00"}','gone')->>'status'='404','a replay of a deleted balancete answers NOT_FOUND');

-- Audit carries every write with its resource.
RESET ROLE;
SELECT public.test_assert((SELECT count(*) FROM tasks_api_private.audit WHERE operation='balancetes.delete' AND resource_id='81000000-0000-0000-0000-000000000004')=1,'a delete is audited');
SELECT public.test_assert((SELECT count(*) FROM tasks_api_private.audit WHERE operation='balancetes.upsert' AND resource_id=(:'d_r'::jsonb#>>'{data,id}')::uuid)>=2,'upserts are audited');
SET LOCAL ROLE service_role;

-- Scopes: the domain is separate from tasks, in both directions, and existing keys gain nothing.
SELECT public.t_as(1,'credentials.create',jsonb_build_object('name','all tasks','audience','api','scopes','["tasks:read","tasks:create","tasks:update","tasks:comment","tasks:delete"]'::jsonb,'tokenDigest',repeat('c1',32))) AS r \gset kt_
SELECT public.t_as(1,'credentials.create',jsonb_build_object('name','reader','audience','api','scopes','["balancetes:read"]'::jsonb,'tokenDigest',repeat('c2',32))) AS r \gset kr_
SELECT public.t_as(1,'credentials.create',jsonb_build_object('name','writer','audience','api','scopes','["balancetes:read","balancetes:write"]'::jsonb,'tokenDigest',repeat('c3',32))) AS r \gset kw_
SELECT public.t_as(1,'credentials.create',jsonb_build_object('name','deleter','audience','api','scopes','["balancetes:delete"]'::jsonb,'tokenDigest',repeat('c4',32))) AS r \gset kd_
SELECT public.t_as(1,'credentials.create',jsonb_build_object('name','everything','audience','api','scopes','["tasks:read","tasks:create","tasks:update","tasks:comment","tasks:delete","balancetes:read","balancetes:write","balancetes:delete"]'::jsonb,'tokenDigest',repeat('c5',32))) AS r \gset ka_
SELECT public.test_assert(:'ka_r'::jsonb->>'status'='201' AND jsonb_array_length(:'ka_r'::jsonb#>'{data,scopes}')=8,'a key can hold all eight scopes');
SELECT public.test_assert(public.t_as(1,'credentials.update',jsonb_build_object('id',:'kr_r'::jsonb#>>'{data,id}','scopes','["balancetes:admin"]'::jsonb))#>>'{error,code}'='VALIDATION_ERROR','an unknown scope is refused');
SELECT public.test_assert(public.t_key(repeat('c1',32),'condominiums.list','{}')#>>'{error,code}'='INSUFFICIENT_SCOPE' AND public.t_key(repeat('c1',32),'balancetes.list','{}')#>>'{error,code}'='INSUFFICIENT_SCOPE','a tasks key cannot read this domain');
SELECT public.test_assert(public.t_key(repeat('c2',32),'tasks.list','{}')#>>'{error,code}'='INSUFFICIENT_SCOPE','a balancetes key cannot read tasks');
SELECT public.test_assert(public.t_key(repeat('c2',32),'condominiums.list','{}')->>'status'='200' AND public.t_key(repeat('c2',32),'balancetes.get',jsonb_build_object('id',:'f_r'::jsonb#>>'{data,id}'))->>'status'='200','balancetes:read covers the lookup and the reads');
SELECT public.test_assert(public.t_key(repeat('c2',32),'balancetes.upsert','{"condominiumId":"70000000-0000-0000-0000-000000000001","competencia":"06/2026","generatedAt":"2026-07-10T09:00:00-03:00"}','kk1')#>>'{error,code}'='INSUFFICIENT_SCOPE','reading does not allow writing');
SELECT public.test_assert(public.t_key(repeat('c3',32),'balancetes.upsert','{"condominiumId":"70000000-0000-0000-0000-000000000001","competencia":"06/2026","generatedAt":"2026-07-10T09:00:00-03:00"}','kk2')#>'{data}' @> '{"action":"create","createdById":"10000000-0000-0000-0000-000000000001"}','a writer key writes as its owner') ;
SELECT public.test_assert(public.t_key(repeat('c3',32),'balancetes.delete',jsonb_build_object('id',:'gn_r'::jsonb#>>'{data,id}'))#>>'{error,code}'='INSUFFICIENT_SCOPE','writing does not allow deleting');
SELECT public.test_assert(public.t_key(repeat('c4',32),'balancetes.delete','{"id":"7fffffff-0000-0000-0000-000000000009"}')->>'status'='404','the delete scope reaches the delete');

-- Menu permission follows the domain: losing /balancetes keeps /tarefas, and the reverse.
RESET ROLE;
INSERT INTO public.omnia_user_permissions(user_id,menu_item_id,can_access) VALUES ('10000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002',false);
SET LOCAL ROLE service_role;
SELECT public.test_assert(public.t_as(2,'balancetes.list','{}')#>>'{error,code}'='FORBIDDEN' AND public.t_as(2,'condominiums.list','{}')#>>'{error,code}'='FORBIDDEN','without /balancetes the domain is denied');
SELECT public.test_assert(public.t_as(2,'tasks.list','{}')->>'status'='200','tasks do not depend on /balancetes');
RESET ROLE;
DELETE FROM public.omnia_user_permissions WHERE user_id='10000000-0000-0000-0000-000000000002';
INSERT INTO public.omnia_user_permissions(user_id,menu_item_id,can_access) VALUES ('10000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001',false);
SET LOCAL ROLE service_role;
SELECT public.test_assert(public.t_as(2,'tasks.list','{}')#>>'{error,code}'='FORBIDDEN','without /tarefas tasks are denied');
SELECT public.test_assert(public.t_as(2,'balancetes.list','{}')->>'status'='200','this domain does not depend on /tarefas');
-- The MCP exchange admits a key whose owner only has /balancetes, and refuses one with neither menu.
SELECT public.t_as(2,'credentials.create',jsonb_build_object('name','bob mcp','audience','mcp','scopes','["balancetes:read"]'::jsonb,'tokenDigest',repeat('d1',32))) AS r \gset km_
SELECT public.test_assert(public.t_key(repeat('d1',32),'mcp.exchange',jsonb_build_object('sessionDigest',repeat('d2',32)))->>'status'='201','the exchange admits an owner with only /balancetes');
SELECT public.test_assert(public.t_key(repeat('d2',32),'balancetes.list','{}')->>'status'='200','the exchanged capability reads the domain');
RESET ROLE;
INSERT INTO public.omnia_user_permissions(user_id,menu_item_id,can_access) VALUES ('10000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002',false);
SET LOCAL ROLE service_role;
SELECT public.test_assert(public.t_key(repeat('d1',32),'mcp.exchange',jsonb_build_object('sessionDigest',repeat('d3',32)))#>>'{error,code}'='FORBIDDEN','the exchange refuses an owner with neither menu');
RESET ROLE;
ROLLBACK;
