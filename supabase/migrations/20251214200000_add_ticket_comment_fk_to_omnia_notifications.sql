ALTER TABLE public.omnia_notifications
  ADD COLUMN IF NOT EXISTS ticket_comment_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'omnia_notifications_ticket_comment_id_fkey'
      AND conrelid = 'public.omnia_notifications'::regclass
  ) THEN
    ALTER TABLE public.omnia_notifications
      ADD CONSTRAINT omnia_notifications_ticket_comment_id_fkey
      FOREIGN KEY (ticket_comment_id)
      REFERENCES public.omnia_ticket_comments(id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS omnia_notifications_ticket_comment_id_idx
  ON public.omnia_notifications (ticket_comment_id);

DROP INDEX IF EXISTS public.omnia_notifications_dedupe_unread_idx;
CREATE UNIQUE INDEX IF NOT EXISTS omnia_notifications_dedupe_unread_idx
  ON public.omnia_notifications (type, user_id, ticket_id, COALESCE(comment_id, ticket_comment_id))
  WHERE read_at IS NULL;
