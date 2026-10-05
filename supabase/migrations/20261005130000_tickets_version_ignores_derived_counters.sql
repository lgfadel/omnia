-- A task's version (updated_at, exposed by the API as updatedAt and ETag) is the compare-and-swap
-- token of every edit, in the web app and in integrations. The comment and attachment triggers
-- keep omnia_tickets.comment_count and attachment_count in sync with an UPDATE of the task row,
-- and the generic updated_at trigger turned each of those into a new version. Adding a comment
-- therefore made another person's in-flight edit fail with 412 although no field they were editing
-- had changed.
--
-- Counter-only updates now keep updated_at. Any other update, including a no-op one, behaves as before.
-- update_updated_at_column() is shared by ~20 tables, so tickets get a dedicated trigger function.
CREATE OR REPLACE FUNCTION public.omnia_tickets_touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF (NEW.comment_count IS DISTINCT FROM OLD.comment_count OR NEW.attachment_count IS DISTINCT FROM OLD.attachment_count)
     AND (to_jsonb(NEW) - 'comment_count' - 'attachment_count' - 'updated_at') = (to_jsonb(OLD) - 'comment_count' - 'attachment_count' - 'updated_at') THEN
    NEW.updated_at = OLD.updated_at;
  ELSE
    NEW.updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER update_tickets_updated_at BEFORE UPDATE ON public.omnia_tickets
  FOR EACH ROW EXECUTE FUNCTION public.omnia_tickets_touch_updated_at();
