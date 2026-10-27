-- Return the event and readable context to the push sender.
-- The existing sender remains compatible with these additional columns.
DROP FUNCTION public.omnia_claim_push_jobs(integer);
CREATE FUNCTION public.omnia_claim_push_jobs(batch_size integer DEFAULT 50)
RETURNS TABLE(job_id bigint, subscription_id uuid, endpoint text, p256dh text, auth_key text,
  notification_id uuid, ticket_id uuid, ata_id uuid, comment_id uuid, attempts integer,
  notification_type text, entity_kind text, entity_title text, task_number integer, ata_code text, actor_name text)
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  WITH selected AS (
    SELECT j.id FROM public.omnia_push_jobs j
    WHERE j.available_at <= now() AND (j.locked_until IS NULL OR j.locked_until < now())
    ORDER BY j.id FOR UPDATE SKIP LOCKED LIMIT least(greatest(batch_size, 1), 100)
  ), claimed AS (
    UPDATE public.omnia_push_jobs j SET locked_until = now() + interval '5 minutes', attempts = j.attempts + 1
    FROM selected WHERE j.id = selected.id RETURNING j.*
  )
  SELECT j.id, s.id, s.endpoint, s.p256dh, s.auth_key, n.id, n.ticket_id,
    coalesce(n.ata_id, c.ata_id), n.comment_id, j.attempts,
    n.type, CASE WHEN n.ticket_id IS NOT NULL THEN 'task' ELSE 'ata' END,
    CASE WHEN n.ticket_id IS NOT NULL THEN t.title ELSE a.title END,
    t.ticket_id, a.code, actor.name
  FROM claimed j JOIN public.omnia_push_subscriptions s ON s.id = j.subscription_id
    JOIN public.omnia_notifications n ON n.id = j.notification_id
    JOIN public.omnia_users recipient ON recipient.id = n.user_id
    LEFT JOIN public.omnia_comments c ON c.id = n.comment_id
    -- Mirror task read restrictions before including a title or number in push.
    LEFT JOIN public.omnia_tickets t ON t.id = n.ticket_id
      AND coalesce(recipient.active, true)
      AND recipient.roles && ARRAY['ADMIN','SECRETARIO','USUARIO']::text[]
      AND public.check_user_menu_permission(recipient.id, '/tarefas')
      AND (t.is_private = false OR t.created_by = recipient.id OR 'ADMIN' = ANY(recipient.roles))
    LEFT JOIN public.omnia_atas a ON a.id = coalesce(n.ata_id, c.ata_id)
      AND coalesce(recipient.active, true)
    LEFT JOIN public.omnia_users actor ON actor.id = n.created_by;
$$;
REVOKE ALL ON FUNCTION public.omnia_claim_push_jobs(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.omnia_claim_push_jobs(integer) TO service_role;
