-- Add attachment_count to omnia_tickets and keep it in sync with omnia_ticket_attachments

ALTER TABLE public.omnia_tickets
ADD COLUMN IF NOT EXISTS attachment_count integer NOT NULL DEFAULT 0;

-- Backfill existing rows
UPDATE public.omnia_tickets t
SET attachment_count = COALESCE(a.cnt, 0)
FROM (
  SELECT ticket_id, COUNT(*)::integer AS cnt
  FROM public.omnia_ticket_attachments
  GROUP BY ticket_id
) a
WHERE a.ticket_id = t.id;

-- Ensure rows without attachments are 0
UPDATE public.omnia_tickets
SET attachment_count = 0
WHERE attachment_count IS NULL;

CREATE OR REPLACE FUNCTION public.update_ticket_attachment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.omnia_tickets
    SET attachment_count = attachment_count + 1
    WHERE id = NEW.ticket_id;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.omnia_tickets
    SET attachment_count = GREATEST(attachment_count - 1, 0)
    WHERE id = OLD.ticket_id;
    RETURN OLD;

  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.ticket_id IS DISTINCT FROM OLD.ticket_id THEN
      UPDATE public.omnia_tickets
      SET attachment_count = GREATEST(attachment_count - 1, 0)
      WHERE id = OLD.ticket_id;

      UPDATE public.omnia_tickets
      SET attachment_count = attachment_count + 1
      WHERE id = NEW.ticket_id;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_ticket_attachment_count_trigger ON public.omnia_ticket_attachments;

CREATE TRIGGER update_ticket_attachment_count_trigger
AFTER INSERT OR DELETE OR UPDATE OF ticket_id
ON public.omnia_ticket_attachments
FOR EACH ROW
EXECUTE FUNCTION public.update_ticket_attachment_count();
