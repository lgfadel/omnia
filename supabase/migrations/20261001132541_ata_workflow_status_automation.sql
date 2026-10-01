-- Stable keys keep the ATA workflow independent of editable names/order.
ALTER TABLE public.omnia_statuses
  ADD COLUMN workflow_key text;

ALTER TABLE public.omnia_statuses
  ADD CONSTRAINT omnia_statuses_workflow_key_check
  CHECK (workflow_key IS NULL OR workflow_key IN ('not_started', 'transcription', 'minuta', 'review'));

CREATE UNIQUE INDEX omnia_statuses_workflow_key_unique
  ON public.omnia_statuses (workflow_key)
  WHERE workflow_key IS NOT NULL;

-- Reuse existing workflow statuses where possible. In particular, the
-- review stage is the existing "Revisão/Correções" status, not a new row.
DO $$
DECLARE
  workflow record;
  workflow_status_id uuid;
  next_order integer;
BEGIN
  FOR workflow IN
    SELECT * FROM (VALUES
      ('not_started', 'Não iniciado', ARRAY['não iniciado', 'não iniciada', 'nao iniciado', 'nao iniciada']::text[], '#F59E0B'),
      ('transcription', 'Transcrição', ARRAY['transcrição', 'transcricao']::text[], '#3B82F6'),
      ('minuta', 'Minuta', ARRAY['minuta']::text[], '#8B5CF6'),
      ('review', 'Revisão/Correções', ARRAY['revisão/correções', 'revisao/correcoes', 'revisão', 'revisao']::text[], '#FBBF24')
    ) AS stages(workflow_key, name, aliases, color)
  LOOP
    SELECT id INTO workflow_status_id
    FROM public.omnia_statuses
    WHERE workflow_key = workflow.workflow_key
    LIMIT 1;

    IF workflow_status_id IS NULL THEN
      SELECT id INTO workflow_status_id
      FROM public.omnia_statuses
      WHERE workflow_key IS NULL
        AND lower(btrim(name)) = ANY (workflow.aliases)
      ORDER BY
        CASE
          WHEN workflow.workflow_key = 'review'
            AND lower(btrim(name)) IN ('revisão/correções', 'revisao/correcoes') THEN 0
          ELSE 1
        END,
        CASE WHEN workflow.workflow_key = 'not_started' AND is_default IS TRUE THEN 0 ELSE 1 END,
        order_position,
        created_at,
        id
      LIMIT 1;

      IF workflow_status_id IS NULL AND workflow.workflow_key = 'not_started' THEN
        SELECT id INTO workflow_status_id
        FROM public.omnia_statuses
        WHERE is_default IS TRUE AND workflow_key IS NULL
        ORDER BY order_position, created_at, id
        LIMIT 1;

        IF workflow_status_id IS NOT NULL THEN
          UPDATE public.omnia_statuses
          SET name = workflow.name
          WHERE id = workflow_status_id;
        END IF;
      END IF;

      IF workflow_status_id IS NULL THEN
        SELECT COALESCE(MAX(order_position), 0) + 1 INTO next_order
        FROM public.omnia_statuses;

        INSERT INTO public.omnia_statuses (name, color, order_position, is_default, workflow_key)
        VALUES (workflow.name, workflow.color, next_order, false, workflow.workflow_key)
        RETURNING id INTO workflow_status_id;
      ELSE
        UPDATE public.omnia_statuses
        SET workflow_key = workflow.workflow_key
        WHERE id = workflow_status_id;
      END IF;
    END IF;
  END LOOP;

  UPDATE public.omnia_statuses
  SET is_default = (workflow_key = 'not_started')
  WHERE is_default IS DISTINCT FROM (workflow_key = 'not_started');
END;
$$;

CREATE SCHEMA IF NOT EXISTS omnia_private;
REVOKE ALL ON SCHEMA omnia_private FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION omnia_private.set_new_ata_workflow_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  initial_status_id uuid;
BEGIN
  SELECT status.id INTO initial_status_id
  FROM public.omnia_statuses AS status
  WHERE status.workflow_key = 'not_started';

  IF initial_status_id IS NULL THEN
    RAISE EXCEPTION 'The default ATA workflow status is not configured.';
  END IF;

  NEW.status_id := initial_status_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_new_ata_workflow_status
  BEFORE INSERT ON public.omnia_atas
  FOR EACH ROW EXECUTE FUNCTION omnia_private.set_new_ata_workflow_status();

CREATE OR REPLACE FUNCTION omnia_private.advance_ata_workflow_status(
  target_ata_id uuid,
  target_workflow_key text,
  allowed_workflow_keys text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_status_id uuid;
BEGIN
  SELECT status.id INTO target_status_id
  FROM public.omnia_statuses AS status
  WHERE status.workflow_key = target_workflow_key;

  IF target_status_id IS NULL THEN
    RAISE EXCEPTION 'The ATA workflow status "%" is not configured.', target_workflow_key;
  END IF;

  UPDATE public.omnia_atas AS ata
  SET status_id = target_status_id
  WHERE ata.id = target_ata_id
    AND ata.status_id IN (
      SELECT status.id
      FROM public.omnia_statuses AS status
      WHERE status.workflow_key = ANY (allowed_workflow_keys)
    );
END;
$$;

CREATE OR REPLACE FUNCTION omnia_private.advance_ata_workflow_from_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_TABLE_NAME = 'omnia_ata_transcription_jobs' THEN
    IF NEW.is_current IS NOT TRUE
      OR COALESCE(NEW.status NOT IN ('queued', 'processing', 'completed'), true) THEN
      RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
      IF OLD.status IS NOT DISTINCT FROM NEW.status
        AND OLD.is_current IS NOT DISTINCT FROM NEW.is_current THEN
        RETURN NEW;
      END IF;
    END IF;

    PERFORM omnia_private.advance_ata_workflow_status(
      NEW.ata_id,
      'transcription',
      ARRAY['not_started']
    );
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'omnia_ata_transcriptions' THEN
    IF TG_OP <> 'UPDATE'
      OR NEW.is_reviewed IS NOT TRUE
      OR OLD.is_reviewed IS NOT DISTINCT FROM NEW.is_reviewed
      OR NOT EXISTS (
        SELECT 1
        FROM public.omnia_ata_transcription_jobs AS job
        WHERE job.id = NEW.job_id
          AND job.is_current IS TRUE
          AND job.status = 'completed'
      ) THEN
      RETURN NEW;
    END IF;

    PERFORM omnia_private.advance_ata_workflow_status(
      NEW.ata_id,
      'minuta',
      ARRAY['not_started', 'transcription']
    );
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'omnia_ata_minutas' THEN
    IF NEW.is_current IS NOT TRUE
      OR NEW.status IS DISTINCT FROM 'ready'
      OR COALESCE(btrim(NEW.content), '') = '' THEN
      RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
      IF OLD.status IS NOT DISTINCT FROM NEW.status
        AND OLD.is_current IS NOT DISTINCT FROM NEW.is_current THEN
        RETURN NEW;
      END IF;
    END IF;

    PERFORM omnia_private.advance_ata_workflow_status(
      NEW.ata_id,
      'review',
      ARRAY['not_started', 'transcription', 'minuta']
    );
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Unsupported ATA workflow source: %.', TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER advance_ata_workflow_on_transcription_start
  AFTER INSERT OR UPDATE OF status, is_current ON public.omnia_ata_transcription_jobs
  FOR EACH ROW EXECUTE FUNCTION omnia_private.advance_ata_workflow_from_activity();

CREATE TRIGGER advance_ata_workflow_on_transcription_review
  AFTER UPDATE OF is_reviewed ON public.omnia_ata_transcriptions
  FOR EACH ROW EXECUTE FUNCTION omnia_private.advance_ata_workflow_from_activity();

CREATE TRIGGER advance_ata_workflow_on_minuta_ready
  AFTER INSERT OR UPDATE OF status, is_current ON public.omnia_ata_minutas
  FOR EACH ROW EXECUTE FUNCTION omnia_private.advance_ata_workflow_from_activity();
