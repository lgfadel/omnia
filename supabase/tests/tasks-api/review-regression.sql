\set ON_ERROR_STOP on
-- Each case exercises the public finite RPC using a real service role and a
-- verified human identity. Dates and expected statuses are hand-derived.
INSERT INTO public.omnia_crm_leads(id) VALUES ('50000000-0000-0000-0000-000000000001');
SET ROLE service_role;
DO $$
DECLARE created jsonb; updated jsonb; BEGIN
 created:=public.tasks_api_dispatch('tasks.create','{"title":"Urgent create","priority":"URGENTE"}','20000000-0000-0000-0000-000000000001',NULL,'review-urgent-create');
 PERFORM public.test_assert(created->>'status'='201' AND created#>>'{data,priority}'='URGENTE','existing URGENTE priority accepted on create');
 created:=public.tasks_api_dispatch('tasks.create','{"title":"Urgent update","priority":"NORMAL"}','20000000-0000-0000-0000-000000000001',NULL,'review-urgent-base');
 updated:=public.tasks_api_dispatch('tasks.update',jsonb_build_object('id',created#>>'{data,id}','expectedUpdatedAt',created#>>'{data,updatedAt}','patch',jsonb_build_object('priority','URGENTE')),'20000000-0000-0000-0000-000000000001',NULL,'review-urgent-update');
 PERFORM public.test_assert(updated->>'status'='200' AND updated#>>'{data,priority}'='URGENTE','existing URGENTE priority accepted on update');
END $$;
DO $$
DECLARE created jsonb; changed jsonb; configured jsonb; completed jsonb;
 series_id uuid; second_task public.omnia_tickets%ROWTYPE; template public.omnia_ticket_recurrences%ROWTYPE;
BEGIN
 created:=public.tasks_api_dispatch('tasks.create','{"title":"Template title","description":"Template description","priority":"ALTA","ticketOcta":"template-external","assignedToId":"10000000-0000-0000-0000-000000000001","tags":["template"],"oportunidadeId":"50000000-0000-0000-0000-000000000001","statusId":"40000000-0000-0000-0000-000000000001","recurrence":{"frequency":"DAILY","startDate":"2026-10-04","endType":"AFTER_COUNT","occurrenceLimit":4}}','20000000-0000-0000-0000-000000000001',NULL,'review-template-create');
 PERFORM public.test_assert(created->>'status'='201','template regression first occurrence created');
 series_id:=(created#>>'{data,recurrenceId}')::uuid;
 changed:=public.tasks_api_dispatch('tasks.update',jsonb_build_object('id',created#>>'{data,id}','expectedUpdatedAt',created#>>'{data,updatedAt}','patch','{"title":"Completed occurrence title","description":null,"priority":"BAIXA","ticketOcta":null,"assignedToId":null,"tags":["occurrence"],"oportunidadeId":null,"isPrivate":true,"statusId":"40000000-0000-0000-0000-000000000002"}'::jsonb),'20000000-0000-0000-0000-000000000001',NULL,'review-template-occurrence-edit');
 PERFORM public.test_assert(changed->>'status'='200' AND changed#>>'{data,recurrence,generatedOccurrences}'='2','completed occurrence edited independently');
 configured:=public.tasks_api_dispatch('tasks.update',jsonb_build_object('id',changed#>>'{data,id}','expectedUpdatedAt',changed#>>'{data,updatedAt}','patch','{"recurrence":{"frequency":"DAILY","startDate":"2026-10-04","endType":"AFTER_COUNT","occurrenceLimit":5}}'::jsonb),'20000000-0000-0000-0000-000000000001',NULL,'review-template-config-only');
 PERFORM public.test_assert(configured->>'status'='200','configuration-only edit accepted on completed occurrence');
 SELECT * INTO template FROM public.omnia_ticket_recurrences WHERE id=series_id;
 PERFORM public.test_assert(template.status_id='40000000-0000-0000-0000-000000000001','configuration-only edit preserves pending template status');
 PERFORM public.test_assert(template.title='Template title' AND template.description='Template description' AND template.priority='ALTA' AND template.ticket_octa='template-external' AND template.assigned_to='10000000-0000-0000-0000-000000000001' AND template.tags=ARRAY['template'] AND template.oportunidade_id='50000000-0000-0000-0000-000000000001' AND NOT template.is_private,'configuration-only edit preserves occurrence-independent template fields');
 SELECT * INTO second_task FROM public.omnia_tickets WHERE recurrence_id=series_id AND recurrence_occurrence=2;
 completed:=public.tasks_api_dispatch('tasks.update',jsonb_build_object('id',second_task.id,'expectedUpdatedAt',second_task.updated_at,'patch',jsonb_build_object('statusId','40000000-0000-0000-0000-000000000002')),'20000000-0000-0000-0000-000000000001',NULL,'review-template-generate');
 PERFORM public.test_assert(completed->>'status'='200','next pending occurrence completion accepted');
 PERFORM public.test_assert(EXISTS(SELECT 1 FROM public.omnia_tickets WHERE recurrence_id=series_id AND recurrence_occurrence=3 AND status_id='40000000-0000-0000-0000-000000000001' AND title='Template title' AND description='Template description' AND priority='ALTA' AND ticket_octa='template-external' AND assigned_to='10000000-0000-0000-0000-000000000001' AND tags=ARRAY['template'] AND oportunidade_id='50000000-0000-0000-0000-000000000001' AND NOT is_private),'generated future occurrence remains pending with original template fields');
 -- Explicit task fields accompanying recurrence configuration still update the
 -- template; nullable clears must be distinguished from absent fields.
 configured:=public.tasks_api_dispatch('tasks.update',jsonb_build_object('id',configured#>>'{data,id}','expectedUpdatedAt',configured#>>'{data,updatedAt}','patch','{"title":"Intentional template title","description":null,"priority":"URGENTE","ticketOcta":null,"assignedToId":null,"tags":[],"oportunidadeId":null,"isPrivate":true,"statusId":"40000000-0000-0000-0000-000000000001","recurrence":{"frequency":"DAILY","startDate":"2026-10-04","endType":"AFTER_COUNT","occurrenceLimit":5}}'::jsonb),'20000000-0000-0000-0000-000000000001',NULL,'review-template-explicit');
 PERFORM public.test_assert(configured->>'status'='200','explicit template patch accepted');
 SELECT * INTO template FROM public.omnia_ticket_recurrences WHERE id=series_id;
 PERFORM public.test_assert(template.title='Intentional template title' AND template.description IS NULL AND template.priority='URGENTE' AND template.ticket_octa IS NULL AND template.assigned_to IS NULL AND template.tags='{}' AND template.oportunidade_id IS NULL AND template.is_private AND template.status_id='40000000-0000-0000-0000-000000000001','only explicit fields including nullable clears update the template');
END $$;
DO $$
DECLARE created jsonb; completed jsonb; cleared jsonb; configured jsonb; second_task public.omnia_tickets%ROWTYPE; series_id uuid;
BEGIN
 created:=public.tasks_api_dispatch('tasks.create','{"title":"Cleared generated dates","dueDate":"2026-10-04","recurrence":{"frequency":"DAILY","startDate":"2026-10-04"}}','20000000-0000-0000-0000-000000000001',NULL,'review-cleared-create');
 series_id:=(created#>>'{data,recurrenceId}')::uuid;
 completed:=public.tasks_api_dispatch('tasks.update',jsonb_build_object('id',created#>>'{data,id}','expectedUpdatedAt',created#>>'{data,updatedAt}','patch',jsonb_build_object('dueDate',NULL,'statusId','40000000-0000-0000-0000-000000000002')),'20000000-0000-0000-0000-000000000001',NULL,'review-cleared-complete');
 PERFORM public.test_assert(completed->>'status'='200' AND completed#>>'{data,recurrence,nextOccurrenceDate}'='2026-10-06','two generated occurrences establish advanced cursor');
 SELECT * INTO second_task FROM public.omnia_tickets WHERE recurrence_id=series_id AND recurrence_occurrence=2;
 cleared:=public.tasks_api_dispatch('tasks.update',jsonb_build_object('id',second_task.id,'expectedUpdatedAt',second_task.updated_at,'patch',jsonb_build_object('dueDate',NULL)),'20000000-0000-0000-0000-000000000001',NULL,'review-cleared-second');
 PERFORM public.test_assert(cleared->>'status'='200','all generated occurrence dates can be cleared');
 configured:=public.tasks_api_dispatch('tasks.update',jsonb_build_object('id',completed#>>'{data,id}','expectedUpdatedAt',completed#>>'{data,updatedAt}','patch','{"recurrence":{"frequency":"DAILY","startDate":"2026-10-04"}}'::jsonb),'20000000-0000-0000-0000-000000000001',NULL,'review-cleared-config');
 PERFORM public.test_assert(configured->>'status'='200' AND configured#>>'{data,recurrence,nextOccurrenceDate}'='2026-10-06','configuration save after clearing all occurrence dates does not rewind cursor');
 completed:=public.tasks_api_dispatch('tasks.update',jsonb_build_object('id',cleared#>>'{data,id}','expectedUpdatedAt',cleared#>>'{data,updatedAt}','patch',jsonb_build_object('statusId','40000000-0000-0000-0000-000000000002')),'20000000-0000-0000-0000-000000000001',NULL,'review-cleared-generate');
 PERFORM public.test_assert(completed->>'status'='200' AND EXISTS(SELECT 1 FROM public.omnia_tickets WHERE recurrence_id=series_id AND recurrence_occurrence=3 AND due_date='2026-10-06'),'future generation uses advanced cursor after all occurrence dates cleared');
END $$;
DO $$
DECLARE created jsonb; changed jsonb; configured jsonb; completed jsonb; paused jsonb; resumed jsonb;
 variant text; due_value text; series_id uuid;
BEGIN
 FOREACH variant IN ARRAY ARRAY['postponed','cleared'] LOOP
  created:=public.tasks_api_dispatch('tasks.create','{"title":"Cursor recurrence","dueDate":"2026-10-04","recurrence":{"frequency":"DAILY","interval":1,"startDate":"2026-10-04"}}','20000000-0000-0000-0000-000000000001',NULL,'review-cursor-create-'||variant);
  PERFORM public.test_assert(created->>'status'='201','cursor regression first occurrence created: '||variant);
  series_id:=(created#>>'{data,recurrenceId}')::uuid;
  due_value:=CASE WHEN variant='postponed' THEN '2026-12-04' ELSE NULL END;
  changed:=public.tasks_api_dispatch('tasks.update',jsonb_build_object('id',created#>>'{data,id}','expectedUpdatedAt',created#>>'{data,updatedAt}','patch',jsonb_build_object('dueDate',due_value)),'20000000-0000-0000-0000-000000000001',NULL,'review-cursor-due-'||variant);
  PERFORM public.test_assert(changed->>'status'='200','occurrence deadline edit accepted: '||variant);
  configured:=public.tasks_api_dispatch('tasks.update',jsonb_build_object('id',changed#>>'{data,id}','expectedUpdatedAt',changed#>>'{data,updatedAt}','patch','{"recurrence":{"frequency":"DAILY","interval":1,"startDate":"2026-10-04"}}'::jsonb),'20000000-0000-0000-0000-000000000001',NULL,'review-cursor-save-'||variant);
  PERFORM public.test_assert(configured->>'status'='200' AND configured#>>'{data,recurrence,nextOccurrenceDate}'='2026-10-05','unchanged configuration preserves cursor after '||variant||' deadline');
  -- Match the existing human flow: keep the pending date when cadence/start
  -- changes. New cadence applies after that pending occurrence is generated.
  configured:=public.tasks_api_dispatch('tasks.update',jsonb_build_object('id',configured#>>'{data,id}','expectedUpdatedAt',configured#>>'{data,updatedAt}','patch','{"recurrence":{"frequency":"WEEKLY","interval":2,"startDate":"2026-11-01"}}'::jsonb),'20000000-0000-0000-0000-000000000001',NULL,'review-cursor-cadence-'||variant);
  PERFORM public.test_assert(configured->>'status'='200' AND configured#>>'{data,recurrence,nextOccurrenceDate}'='2026-10-05','cadence and start changes preserve persisted pending date: '||variant);
  completed:=public.tasks_api_dispatch('tasks.update',jsonb_build_object('id',configured#>>'{data,id}','expectedUpdatedAt',configured#>>'{data,updatedAt}','patch',jsonb_build_object('statusId','40000000-0000-0000-0000-000000000002')),'20000000-0000-0000-0000-000000000001',NULL,'review-cursor-complete-'||variant);
  PERFORM public.test_assert(completed->>'status'='200' AND completed#>>'{data,recurrence,nextOccurrenceDate}'='2026-10-19','new cadence advances from persisted pending date: '||variant);
  PERFORM public.test_assert(EXISTS(SELECT 1 FROM public.omnia_tickets WHERE recurrence_id=series_id AND recurrence_occurrence=2 AND due_date='2026-10-05'),'generation uses series cursor despite occurrence deadline: '||variant);
  paused:=public.tasks_api_dispatch('tasks.update',jsonb_build_object('id',completed#>>'{data,id}','expectedUpdatedAt',completed#>>'{data,updatedAt}','patch','{"recurrence":{"frequency":"WEEKLY","interval":2,"startDate":"2026-11-01","isActive":false}}'::jsonb),'20000000-0000-0000-0000-000000000001',NULL,'review-cursor-pause-'||variant);
  PERFORM public.test_assert(paused->>'status'='200' AND paused#>'{data,recurrence,nextOccurrenceDate}'='null'::jsonb AND paused#>>'{data,recurrence,isActive}'='false','pause clears generation cursor: '||variant);
  resumed:=public.tasks_api_dispatch('tasks.update',jsonb_build_object('id',paused#>>'{data,id}','expectedUpdatedAt',paused#>>'{data,updatedAt}','patch','{"recurrence":{"frequency":"WEEKLY","interval":2,"startDate":"2026-11-01","isActive":true}}'::jsonb),'20000000-0000-0000-0000-000000000001',NULL,'review-cursor-resume-'||variant);
  PERFORM public.test_assert(resumed->>'status'='200' AND resumed#>>'{data,recurrence,nextOccurrenceDate}'='2026-11-29' AND resumed#>>'{data,recurrence,generatedOccurrences}'='2','reactivation reconstructs missing cursor from series start and count: '||variant);
 END LOOP;
END $$;
DO $$
DECLARE created jsonb; completed jsonb; cleared jsonb; configured jsonb; second_task public.omnia_tickets%ROWTYPE; series_id uuid;
BEGIN
 created:=public.tasks_api_dispatch('tasks.create','{"title":"Month-end exhausted recurrence","dueDate":"2026-01-31","recurrence":{"frequency":"MONTHLY","startDate":"2026-01-31","endType":"AFTER_COUNT","occurrenceLimit":2}}','20000000-0000-0000-0000-000000000001',NULL,'review-exhausted-create');
 series_id:=(created#>>'{data,recurrenceId}')::uuid;
 completed:=public.tasks_api_dispatch('tasks.update',jsonb_build_object('id',created#>>'{data,id}','expectedUpdatedAt',created#>>'{data,updatedAt}','patch',jsonb_build_object('statusId','40000000-0000-0000-0000-000000000002','dueDate',NULL)),'20000000-0000-0000-0000-000000000001',NULL,'review-exhausted-complete');
 PERFORM public.test_assert(completed->>'status'='200' AND completed#>>'{data,recurrence,isActive}'='false' AND completed#>'{data,recurrence,nextOccurrenceDate}'='null'::jsonb,'count bound exhausts series with no cursor');
 SELECT * INTO second_task FROM public.omnia_tickets WHERE recurrence_id=series_id AND recurrence_occurrence=2;
 cleared:=public.tasks_api_dispatch('tasks.update',jsonb_build_object('id',second_task.id,'expectedUpdatedAt',second_task.updated_at,'patch',jsonb_build_object('dueDate',NULL)),'20000000-0000-0000-0000-000000000001',NULL,'review-exhausted-clear');
 PERFORM public.test_assert(cleared->>'status'='200','all exhausted occurrence dates can be cleared');
 configured:=public.tasks_api_dispatch('tasks.update',jsonb_build_object('id',completed#>>'{data,id}','expectedUpdatedAt',completed#>>'{data,updatedAt}','patch','{"recurrence":{"frequency":"MONTHLY","startDate":"2026-01-31","endType":"AFTER_COUNT","occurrenceLimit":2}}'::jsonb),'20000000-0000-0000-0000-000000000001',NULL,'review-exhausted-unchanged');
 PERFORM public.test_assert(configured->>'status'='200' AND configured#>>'{data,recurrence,isActive}'='false' AND configured#>'{data,recurrence,nextOccurrenceDate}'='null'::jsonb,'unchanged exhausted bounds preserve null cursor');
 configured:=public.tasks_api_dispatch('tasks.update',jsonb_build_object('id',configured#>>'{data,id}','expectedUpdatedAt',configured#>>'{data,updatedAt}','patch','{"recurrence":{"frequency":"MONTHLY","startDate":"2026-01-31","endType":"AFTER_COUNT","occurrenceLimit":4}}'::jsonb),'20000000-0000-0000-0000-000000000001',NULL,'review-exhausted-extend');
 PERFORM public.test_assert(configured->>'status'='200' AND configured#>>'{data,recurrence,nextOccurrenceDate}'='2026-03-28' AND configured#>>'{data,recurrence,generatedOccurrences}'='2','extended bounds reconstruct month-end cursor without mutable occurrence dates');
END $$;
RESET ROLE;
