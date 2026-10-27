ALTER TABLE public.omnia_notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE public.omnia_notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('assigned','secretary','responsible','mentioned','commented'));
CREATE UNIQUE INDEX omnia_notifications_comment_recipient_idx ON public.omnia_notifications(user_id,comment_id)
  WHERE type IN ('commented','mentioned') AND comment_id IS NOT NULL;
CREATE UNIQUE INDEX omnia_notifications_ticket_comment_recipient_idx ON public.omnia_notifications(user_id,ticket_comment_id)
  WHERE type IN ('commented','mentioned') AND ticket_comment_id IS NOT NULL;

-- Database events cover the interface, official API and integrations atomically.
-- A mention takes precedence over a general comment notification for that recipient.
CREATE OR REPLACE FUNCTION private.omnia_notify_new_comment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid; task public.omnia_tickets; meeting public.omnia_atas; mentioned uuid[];
BEGIN
  SELECT id INTO actor FROM public.omnia_users WHERE auth_user_id=auth.uid();
  actor := coalesce(actor, NEW.author_id);
  SELECT coalesce(array_agg(DISTINCT matches[1]::uuid),'{}'::uuid[]) INTO mentioned
  FROM regexp_matches(coalesce(NEW.body,''),'@\[([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\]','g') AS matches;
  IF TG_TABLE_NAME='omnia_ticket_comments' THEN
    SELECT * INTO task FROM public.omnia_tickets WHERE id=NEW.ticket_id;
    IF NOT FOUND THEN RETURN NEW; END IF;
    INSERT INTO public.omnia_notifications(user_id,type,ticket_id,ticket_comment_id,created_by)
      SELECT u.id, CASE WHEN u.id=ANY(mentioned) THEN 'mentioned' ELSE 'commented' END, task.id, NEW.id, actor
      FROM public.omnia_users u
      WHERE (u.id=ANY(ARRAY[task.created_by,task.assigned_to]) OR u.id=ANY(mentioned))
        AND u.id IS DISTINCT FROM actor AND coalesce(u.active,true)
        AND u.roles && ARRAY['ADMIN','SECRETARIO','USUARIO']::text[]
        AND public.check_user_menu_permission(u.id,'/tarefas')
        AND (task.is_private=false OR task.created_by=u.id OR 'ADMIN'=ANY(u.roles))
      ON CONFLICT DO NOTHING;
  ELSIF TG_TABLE_NAME='omnia_comments' THEN
    SELECT * INTO meeting FROM public.omnia_atas WHERE id=NEW.ata_id;
    IF NOT FOUND THEN RETURN NEW; END IF;
    INSERT INTO public.omnia_notifications(user_id,type,ata_id,comment_id,created_by)
      -- Legacy mention calls identify the ata through comment_id; preserve that
      -- shape so the existing mention index makes those calls idempotent.
      SELECT u.id, CASE WHEN u.id=ANY(mentioned) THEN 'mentioned' ELSE 'commented' END,
        CASE WHEN u.id=ANY(mentioned) THEN NULL ELSE meeting.id END, NEW.id, actor
      FROM public.omnia_users u
      WHERE (u.id=ANY(ARRAY[meeting.created_by,meeting.responsible_id,meeting.secretary_id]) OR u.id=ANY(mentioned))
        AND u.id IS DISTINCT FROM actor AND coalesce(u.active,true)
      ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.omnia_notify_new_comment() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER omnia_notify_new_ticket_comment AFTER INSERT ON public.omnia_ticket_comments
  FOR EACH ROW EXECUTE FUNCTION private.omnia_notify_new_comment();
CREATE TRIGGER omnia_notify_new_ata_comment AFTER INSERT ON public.omnia_comments
  FOR EACH ROW EXECUTE FUNCTION private.omnia_notify_new_comment();
