ALTER TABLE public.omnia_notifications
  ADD COLUMN IF NOT EXISTS ata_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'omnia_notifications_ata_id_fkey'
      AND conrelid = 'public.omnia_notifications'::regclass
  ) THEN
    ALTER TABLE public.omnia_notifications
      ADD CONSTRAINT omnia_notifications_ata_id_fkey
      FOREIGN KEY (ata_id)
      REFERENCES public.omnia_atas(id)
      ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE public.omnia_notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.omnia_notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY['assigned'::text, 'secretary'::text, 'responsible'::text, 'mentioned'::text]));

CREATE INDEX IF NOT EXISTS omnia_notifications_ata_id_idx
  ON public.omnia_notifications (ata_id);

DROP INDEX IF EXISTS public.omnia_notifications_type_user_ticket_comment_idx;
CREATE INDEX IF NOT EXISTS omnia_notifications_type_user_ticket_comment_idx
  ON public.omnia_notifications (type, user_id, ticket_id, ata_id, comment_id, ticket_comment_id);

DROP INDEX IF EXISTS public.omnia_notifications_dedupe_unread_idx;
CREATE UNIQUE INDEX IF NOT EXISTS omnia_notifications_dedupe_unread_idx
  ON public.omnia_notifications (
    type,
    user_id,
    COALESCE(ticket_id, ata_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(comment_id, ticket_comment_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE read_at IS NULL AND type = 'mentioned';

CREATE UNIQUE INDEX IF NOT EXISTS omnia_notifications_dedupe_unread_assigned_idx
  ON public.omnia_notifications (type, user_id, ticket_id)
  WHERE read_at IS NULL AND type = 'assigned';

CREATE UNIQUE INDEX IF NOT EXISTS omnia_notifications_dedupe_unread_secretary_idx
  ON public.omnia_notifications (type, user_id, ata_id)
  WHERE read_at IS NULL AND type = 'secretary';

CREATE UNIQUE INDEX IF NOT EXISTS omnia_notifications_dedupe_unread_responsible_idx
  ON public.omnia_notifications (type, user_id, ata_id)
  WHERE read_at IS NULL AND type = 'responsible';

CREATE OR REPLACE FUNCTION public.omnia_notify_ticket_assigned_to_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_omnia_user_id uuid;
BEGIN
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    IF NEW.assigned_to IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT id
      INTO actor_omnia_user_id
      FROM public.omnia_users
      WHERE auth_user_id = auth.uid();

    IF actor_omnia_user_id IS NOT NULL AND NEW.assigned_to = actor_omnia_user_id THEN
      RETURN NEW;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.omnia_users u
      WHERE u.id = NEW.assigned_to
        AND COALESCE(u.active, true) = true
    ) THEN
      INSERT INTO public.omnia_notifications (user_id, type, ticket_id, created_by)
      VALUES (NEW.assigned_to, 'assigned', NEW.id, actor_omnia_user_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS omnia_notify_ticket_assigned_to_change ON public.omnia_tickets;
CREATE TRIGGER omnia_notify_ticket_assigned_to_change
AFTER UPDATE OF assigned_to ON public.omnia_tickets
FOR EACH ROW
EXECUTE FUNCTION public.omnia_notify_ticket_assigned_to_change();

CREATE OR REPLACE FUNCTION public.omnia_notify_ata_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_omnia_user_id uuid;
BEGIN
  SELECT id
    INTO actor_omnia_user_id
    FROM public.omnia_users
    WHERE auth_user_id = auth.uid();

  IF NEW.secretary_id IS DISTINCT FROM OLD.secretary_id THEN
    IF NEW.secretary_id IS NOT NULL
      AND (actor_omnia_user_id IS NULL OR NEW.secretary_id <> actor_omnia_user_id)
      AND EXISTS (
        SELECT 1
        FROM public.omnia_users u
        WHERE u.id = NEW.secretary_id
          AND COALESCE(u.active, true) = true
      ) THEN
      INSERT INTO public.omnia_notifications (user_id, type, ata_id, created_by)
      VALUES (NEW.secretary_id, 'secretary', NEW.id, actor_omnia_user_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  IF NEW.responsible_id IS DISTINCT FROM OLD.responsible_id THEN
    IF NEW.responsible_id IS NOT NULL
      AND (actor_omnia_user_id IS NULL OR NEW.responsible_id <> actor_omnia_user_id)
      AND EXISTS (
        SELECT 1
        FROM public.omnia_users u
        WHERE u.id = NEW.responsible_id
          AND COALESCE(u.active, true) = true
      ) THEN
      INSERT INTO public.omnia_notifications (user_id, type, ata_id, created_by)
      VALUES (NEW.responsible_id, 'responsible', NEW.id, actor_omnia_user_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS omnia_notify_ata_role_change ON public.omnia_atas;
CREATE TRIGGER omnia_notify_ata_role_change
AFTER UPDATE OF secretary_id, responsible_id ON public.omnia_atas
FOR EACH ROW
EXECUTE FUNCTION public.omnia_notify_ata_role_change();
