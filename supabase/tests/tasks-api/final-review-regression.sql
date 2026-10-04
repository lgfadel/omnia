\set ON_ERROR_STOP on
-- Final-review regressions run only in the isolated fixture. Every case rolls
-- back its fixture changes, including temporary fault injection and rate debits.

-- Missing resources consume the same 120/minute actor budget as successful ones.
BEGIN;
DELETE FROM tasks_api_private.rate_limits;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000003',true);
SELECT set_config('request.jwt.claim.role','service_role',true);
SELECT set_config('request.jwt.claims','{"role":"service_role","sub":"20000000-0000-0000-0000-000000000003","extra":"preserved"}',true);
DO $$
DECLARE response jsonb; attempt integer; old_claims text:=current_setting('request.jwt.claims');
BEGIN
 -- Keep this short burst clear of a minute boundary without changing the clock.
 IF extract(second FROM clock_timestamp())>58 THEN PERFORM pg_sleep(2); END IF;
 FOR attempt IN 1..125 LOOP
  response:=public.tasks_api_dispatch('tasks.get','{"id":"ffffffff-ffff-ffff-ffff-ffffffffffff"}','20000000-0000-0000-0000-000000000001');
  IF attempt<=120 THEN
   PERFORM public.test_assert(response->>'status'='404' AND response#>>'{error,code}'='NOT_FOUND','authenticated missing task consumes attempt '||attempt);
  ELSE
   PERFORM public.test_assert(response->>'status'='429' AND response#>>'{error,code}'='RATE_LIMITED','domain errors exhaust budget after 120 attempts: '||attempt);
  END IF;
  PERFORM public.test_assert(current_setting('request.jwt.claim.sub')='20000000-0000-0000-0000-000000000003' AND current_setting('request.jwt.claim.role')='service_role' AND current_setting('request.jwt.claims')=old_claims,'all legacy and JSON claims restored after domain/rate error');
 END LOOP;
END $$;
RESET ROLE;
SELECT public.test_assert((SELECT sum(requests) FROM tasks_api_private.rate_limits WHERE actor_id='10000000-0000-0000-0000-000000000001')=120,'repeated 429 responses preserve the exhausted counter at 120');
ROLLBACK;

-- Recurrence validation happens after the task INSERT: that insert must roll
-- back, while the verified attempt's debit survives the returned domain error.
BEGIN;
DELETE FROM tasks_api_private.rate_limits;
CREATE TEMP TABLE final_review_counts ON COMMIT DROP AS SELECT
 (SELECT count(*) FROM public.omnia_tickets) tasks,
 (SELECT count(*) FROM public.omnia_ticket_recurrences) series,
 (SELECT count(*) FROM tasks_api_private.audit) audits,
 (SELECT count(*) FROM tasks_api_private.idempotency) replays;
SET LOCAL ROLE service_role;
SELECT public.test_assert(public.tasks_api_dispatch('tasks.create','{"title":"Failed recurrence write","recurrence":{"frequency":"DAILY","startDate":"2026-10-04","interval":0}}','20000000-0000-0000-0000-000000000001',NULL,'final-invalid-recurrence')#>>'{error,code}'='VALIDATION_ERROR','invalid recurrence returns typed failure after task insert');
RESET ROLE;
SELECT public.test_assert((SELECT count(*) FROM public.omnia_tickets)=(SELECT tasks FROM final_review_counts) AND (SELECT count(*) FROM public.omnia_ticket_recurrences)=(SELECT series FROM final_review_counts) AND (SELECT count(*) FROM tasks_api_private.audit)=(SELECT audits FROM final_review_counts) AND (SELECT count(*) FROM tasks_api_private.idempotency)=(SELECT replays FROM final_review_counts),'failed recurrence leaves no task, series, audit or replay');
SELECT public.test_assert((SELECT sum(requests) FROM tasks_api_private.rate_limits WHERE actor_id='10000000-0000-0000-0000-000000000001')=1,'failed partial write still consumes one request');
ROLLBACK;

-- A late audit failure also rolls back the task and already-inserted replay.
BEGIN;
DELETE FROM tasks_api_private.rate_limits;
CREATE TEMP TABLE final_review_counts ON COMMIT DROP AS SELECT
 (SELECT count(*) FROM public.omnia_tickets) tasks,
 (SELECT count(*) FROM tasks_api_private.audit) audits,
 (SELECT count(*) FROM tasks_api_private.idempotency) replays;
ALTER TABLE tasks_api_private.audit ADD CONSTRAINT final_review_reject_audit CHECK (operation<>'tasks.create') NOT VALID;
SET LOCAL ROLE service_role;
SELECT public.test_assert(public.tasks_api_dispatch('tasks.create','{"title":"Failed audit write"}','20000000-0000-0000-0000-000000000001',NULL,'final-failed-audit')#>>'{error,code}'='VALIDATION_ERROR','late audit failure returns typed error');
RESET ROLE;
SELECT public.test_assert((SELECT count(*) FROM public.omnia_tickets)=(SELECT tasks FROM final_review_counts) AND (SELECT count(*) FROM tasks_api_private.audit)=(SELECT audits FROM final_review_counts) AND (SELECT count(*) FROM tasks_api_private.idempotency)=(SELECT replays FROM final_review_counts),'late failure leaves no task, audit or replay');
SELECT public.test_assert((SELECT sum(requests) FROM tasks_api_private.rate_limits WHERE actor_id='10000000-0000-0000-0000-000000000001')=1,'late failed write still consumes one request');
ROLLBACK;

-- On CREATE the human's recurrence start is the first scheduled due date.
BEGIN;
DELETE FROM tasks_api_private.rate_limits;
SET LOCAL ROLE service_role;
DO $$
DECLARE created jsonb; standalone jsonb; edited jsonb;
BEGIN
 created:=public.tasks_api_dispatch('tasks.create','{"title":"Different recurrence dates","dueDate":"2026-12-01","recurrence":{"frequency":"DAILY","startDate":"2026-10-04"}}','20000000-0000-0000-0000-000000000001',NULL,'final-first-recurrence-date');
 PERFORM public.test_assert(created->>'status'='201' AND created#>>'{data,dueDate}'='2026-10-04' AND created#>>'{data,recurrence,nextOccurrenceDate}'='2026-10-05','recurring CREATE uses start date despite independent due date');
 standalone:=public.tasks_api_dispatch('tasks.create','{"title":"Standalone date","dueDate":"2026-12-01","recurrence":null}','20000000-0000-0000-0000-000000000001',NULL,'final-standalone-date');
 PERFORM public.test_assert(standalone->>'status'='201' AND standalone#>>'{data,dueDate}'='2026-12-01','standalone CREATE preserves chosen due date');
 edited:=public.tasks_api_dispatch('tasks.update',jsonb_build_object('id',created#>>'{data,id}','expectedUpdatedAt',created#>>'{data,updatedAt}','patch','{"dueDate":"2026-12-01","recurrence":{"frequency":"DAILY","startDate":"2026-10-04"}}'::jsonb),'20000000-0000-0000-0000-000000000001',NULL,'final-independent-occurrence-date');
 PERFORM public.test_assert(edited->>'status'='200' AND edited#>>'{data,dueDate}'='2026-12-01' AND edited#>>'{data,recurrence,nextOccurrenceDate}'='2026-10-05','later edits preserve independent occurrence date and pending series cursor');
END $$;
ROLLBACK;

-- Initial bounds include ON_DATE, with equality allowing exactly the first slot.
BEGIN;
DELETE FROM tasks_api_private.rate_limits;
SET LOCAL ROLE service_role;
DO $$
DECLARE created jsonb; completed jsonb; series_id uuid;
BEGIN
 created:=public.tasks_api_dispatch('tasks.create','{"title":"Single date recurrence","recurrence":{"frequency":"DAILY","startDate":"2026-10-04","endType":"ON_DATE","endDate":"2026-10-04"}}','20000000-0000-0000-0000-000000000001',NULL,'final-on-date-exhausted');
 PERFORM public.test_assert(created->>'status'='201' AND created#>>'{data,dueDate}'='2026-10-04' AND created#>>'{data,recurrence,isActive}'='false' AND created#>'{data,recurrence,nextOccurrenceDate}'='null'::jsonb AND created#>>'{data,recurrence,generatedOccurrences}'='1','end date equal to start initializes exhausted inactive series without next date');
 series_id:=(created#>>'{data,recurrenceId}')::uuid;
 completed:=public.tasks_api_dispatch('tasks.update',jsonb_build_object('id',created#>>'{data,id}','expectedUpdatedAt',created#>>'{data,updatedAt}','patch','{"statusId":"40000000-0000-0000-0000-000000000002"}'::jsonb),'20000000-0000-0000-0000-000000000001',NULL,'final-on-date-complete');
 PERFORM public.test_assert(completed->>'status'='200' AND (SELECT count(*) FROM public.omnia_tickets WHERE recurrence_id=series_id)=1,'completing exhausted first occurrence creates no second task');
 created:=public.tasks_api_dispatch('tasks.create','{"title":"Inclusive next date","recurrence":{"frequency":"DAILY","startDate":"2026-10-04","endType":"ON_DATE","endDate":"2026-10-05"}}','20000000-0000-0000-0000-000000000001',NULL,'final-on-date-inclusive');
 PERFORM public.test_assert(created->>'status'='201' AND created#>>'{data,recurrence,isActive}'='true' AND created#>>'{data,recurrence,nextOccurrenceDate}'='2026-10-05','next date equal to end date remains active');
 created:=public.tasks_api_dispatch('tasks.create','{"title":"Single count recurrence","recurrence":{"frequency":"DAILY","startDate":"2026-10-04","endType":"AFTER_COUNT","occurrenceLimit":1}}','20000000-0000-0000-0000-000000000001',NULL,'final-after-count-exhausted');
 PERFORM public.test_assert(created->>'status'='201' AND created#>>'{data,recurrence,isActive}'='false' AND created#>'{data,recurrence,nextOccurrenceDate}'='null'::jsonb,'single-count series remains initially exhausted');
END $$;
ROLLBACK;
