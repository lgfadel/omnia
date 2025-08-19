-- Add foreign keys for tickets relations
ALTER TABLE public.omnia_tickets
  ADD CONSTRAINT omnia_tickets_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.omnia_users(id) ON DELETE SET NULL,
  ADD CONSTRAINT omnia_tickets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.omnia_users(id) ON DELETE SET NULL,
  ADD CONSTRAINT omnia_tickets_status_id_fkey FOREIGN KEY (status_id) REFERENCES public.omnia_ticket_statuses(id) ON DELETE RESTRICT;

-- Fix ticket comment count trigger: drop wrong trigger and create correct function + trigger
DROP TRIGGER IF EXISTS update_ticket_comment_count ON public.omnia_comments;

CREATE OR REPLACE FUNCTION public.update_ticket_comment_count()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.ticket_id IS NOT NULL THEN
      UPDATE public.omnia_tickets SET comment_count = comment_count + 1 WHERE id = NEW.ticket_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.ticket_id IS NOT NULL THEN
      UPDATE public.omnia_tickets SET comment_count = comment_count - 1 WHERE id = OLD.ticket_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER update_ticket_comment_count
AFTER INSERT OR DELETE ON public.omnia_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_ticket_comment_count();