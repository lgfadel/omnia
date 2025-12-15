DO $$
BEGIN
  IF to_regclass('public.notifications') IS NOT NULL
     AND to_regclass('public.omnia_notifications') IS NULL THEN
    ALTER TABLE public.notifications RENAME TO omnia_notifications;
  END IF;
END $$;

ALTER INDEX IF EXISTS public.notifications_user_read_idx RENAME TO omnia_notifications_user_read_idx;
ALTER INDEX IF EXISTS public.notifications_type_user_ticket_comment_idx RENAME TO omnia_notifications_type_user_ticket_comment_idx;
ALTER INDEX IF EXISTS public.notifications_dedupe_unread_idx RENAME TO omnia_notifications_dedupe_unread_idx;

DO $$
BEGIN
  IF to_regclass('public.omnia_notifications') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'notifications_user_id_fkey'
        AND conrelid = 'public.omnia_notifications'::regclass
    ) THEN
      ALTER TABLE public.omnia_notifications
        RENAME CONSTRAINT notifications_user_id_fkey TO omnia_notifications_user_id_fkey;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'notifications_ticket_id_fkey'
        AND conrelid = 'public.omnia_notifications'::regclass
    ) THEN
      ALTER TABLE public.omnia_notifications
        RENAME CONSTRAINT notifications_ticket_id_fkey TO omnia_notifications_ticket_id_fkey;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'notifications_comment_id_fkey'
        AND conrelid = 'public.omnia_notifications'::regclass
    ) THEN
      ALTER TABLE public.omnia_notifications
        RENAME CONSTRAINT notifications_comment_id_fkey TO omnia_notifications_comment_id_fkey;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'notifications_created_by_fkey'
        AND conrelid = 'public.omnia_notifications'::regclass
    ) THEN
      ALTER TABLE public.omnia_notifications
        RENAME CONSTRAINT notifications_created_by_fkey TO omnia_notifications_created_by_fkey;
    END IF;
  END IF;
END $$;
