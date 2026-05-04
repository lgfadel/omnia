DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_recurrence_frequency') THEN
    CREATE TYPE public.ticket_recurrence_frequency AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_recurrence_end_type') THEN
    CREATE TYPE public.ticket_recurrence_end_type AS ENUM ('NEVER', 'ON_DATE', 'AFTER_COUNT');
  END IF;
END $$;

ALTER TABLE public.omnia_ticket_statuses
ADD COLUMN IF NOT EXISTS is_final boolean NOT NULL DEFAULT false;

UPDATE public.omnia_ticket_statuses
SET is_final = true
WHERE lower(name) LIKE '%conclu%'
   OR lower(name) LIKE '%finaliz%';

CREATE TABLE IF NOT EXISTS public.omnia_ticket_recurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_ticket_id uuid REFERENCES public.omnia_tickets(id) ON DELETE SET NULL,
  frequency public.ticket_recurrence_frequency NOT NULL,
  interval integer NOT NULL DEFAULT 1 CHECK (interval > 0),
  start_date date NOT NULL,
  end_type public.ticket_recurrence_end_type NOT NULL DEFAULT 'NEVER',
  end_date date,
  occurrence_limit integer CHECK (occurrence_limit IS NULL OR occurrence_limit > 0),
  generated_occurrences integer NOT NULL DEFAULT 1 CHECK (generated_occurrences >= 0),
  next_occurrence_date date,
  is_active boolean NOT NULL DEFAULT true,
  title text NOT NULL,
  description text,
  priority public.ticket_priority NOT NULL DEFAULT 'NORMAL',
  status_id uuid NOT NULL REFERENCES public.omnia_ticket_statuses(id) ON DELETE RESTRICT,
  assigned_to uuid REFERENCES public.omnia_users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.omnia_users(id) ON DELETE SET NULL,
  oportunidade_id uuid REFERENCES public.omnia_crm_leads(id) ON DELETE SET NULL,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  is_private boolean NOT NULL DEFAULT false,
  ticket_octa text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT omnia_ticket_recurrences_end_date_required CHECK (
    end_type <> 'ON_DATE' OR end_date IS NOT NULL
  ),
  CONSTRAINT omnia_ticket_recurrences_count_required CHECK (
    end_type <> 'AFTER_COUNT' OR occurrence_limit IS NOT NULL
  )
);

ALTER TABLE public.omnia_tickets
ADD COLUMN IF NOT EXISTS recurrence_id uuid REFERENCES public.omnia_ticket_recurrences(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS recurrence_occurrence integer;

CREATE UNIQUE INDEX IF NOT EXISTS idx_omnia_tickets_recurrence_occurrence
ON public.omnia_tickets(recurrence_id, recurrence_occurrence)
WHERE recurrence_id IS NOT NULL AND recurrence_occurrence IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_omnia_ticket_recurrences_due
ON public.omnia_ticket_recurrences(is_active, next_occurrence_date)
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_omnia_tickets_recurrence_id
ON public.omnia_tickets(recurrence_id)
WHERE recurrence_id IS NOT NULL;

ALTER TABLE public.omnia_ticket_recurrences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view ticket recurrences" ON public.omnia_ticket_recurrences;
CREATE POLICY "Authenticated users can view ticket recurrences"
ON public.omnia_ticket_recurrences
FOR SELECT
USING (auth.role() = 'authenticated'::text);

DROP POLICY IF EXISTS "Authenticated users can create ticket recurrences" ON public.omnia_ticket_recurrences;
CREATE POLICY "Authenticated users can create ticket recurrences"
ON public.omnia_ticket_recurrences
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1
  FROM public.omnia_users
  WHERE omnia_users.auth_user_id = auth.uid()
    AND omnia_users.roles && ARRAY['ADMIN'::text, 'SECRETARIO'::text, 'USUARIO'::text]
));

DROP POLICY IF EXISTS "Authenticated users can update ticket recurrences" ON public.omnia_ticket_recurrences;
CREATE POLICY "Authenticated users can update ticket recurrences"
ON public.omnia_ticket_recurrences
FOR UPDATE
USING (EXISTS (
  SELECT 1
  FROM public.omnia_users
  WHERE omnia_users.auth_user_id = auth.uid()
    AND omnia_users.roles && ARRAY['ADMIN'::text, 'SECRETARIO'::text, 'USUARIO'::text]
));

DROP POLICY IF EXISTS "Admins can delete ticket recurrences" ON public.omnia_ticket_recurrences;
CREATE POLICY "Admins can delete ticket recurrences"
ON public.omnia_ticket_recurrences
FOR DELETE
USING (EXISTS (
  SELECT 1
  FROM public.omnia_users
  WHERE omnia_users.auth_user_id = auth.uid()
    AND 'ADMIN'::text = ANY (omnia_users.roles)
));

CREATE OR REPLACE FUNCTION public.add_ticket_recurrence_interval(
  p_date date,
  p_frequency public.ticket_recurrence_frequency,
  p_interval integer
)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  safe_interval integer := GREATEST(1, p_interval);
BEGIN
  IF p_frequency = 'DAILY' THEN
    RETURN p_date + safe_interval;
  ELSIF p_frequency = 'WEEKLY' THEN
    RETURN p_date + (safe_interval * 7);
  END IF;

  RETURN (p_date + (safe_interval || ' months')::interval)::date;
END;
$$;

CREATE OR REPLACE FUNCTION public.touch_omnia_ticket_recurrences_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_omnia_ticket_recurrences_updated_at_trigger ON public.omnia_ticket_recurrences;
CREATE TRIGGER touch_omnia_ticket_recurrences_updated_at_trigger
BEFORE UPDATE ON public.omnia_ticket_recurrences
FOR EACH ROW
EXECUTE FUNCTION public.touch_omnia_ticket_recurrences_updated_at();

CREATE OR REPLACE FUNCTION public.generate_omnia_ticket_recurrences(p_run_date date DEFAULT current_date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recurrence_record public.omnia_ticket_recurrences%ROWTYPE;
  generated_count integer := 0;
  next_occurrence_number integer;
  next_due_date date;
  inserted_ticket_id uuid;
BEGIN
  FOR recurrence_record IN
    SELECT *
    FROM public.omnia_ticket_recurrences
    WHERE is_active = true
      AND next_occurrence_date IS NOT NULL
      AND next_occurrence_date <= p_run_date
    ORDER BY next_occurrence_date, id
    FOR UPDATE SKIP LOCKED
  LOOP
    WHILE recurrence_record.is_active
      AND recurrence_record.next_occurrence_date IS NOT NULL
      AND recurrence_record.next_occurrence_date <= p_run_date
      AND (
        recurrence_record.end_type <> 'ON_DATE'
        OR recurrence_record.next_occurrence_date <= recurrence_record.end_date
      )
      AND (
        recurrence_record.end_type <> 'AFTER_COUNT'
        OR recurrence_record.generated_occurrences < recurrence_record.occurrence_limit
      )
    LOOP
      next_occurrence_number := recurrence_record.generated_occurrences + 1;
      next_due_date := recurrence_record.next_occurrence_date;
      inserted_ticket_id := NULL;

      INSERT INTO public.omnia_tickets (
        title,
        description,
        priority,
        due_date,
        ticket_octa,
        status_id,
        assigned_to,
        created_by,
        oportunidade_id,
        tags,
        is_private,
        recurrence_id,
        recurrence_occurrence
      )
      VALUES (
        recurrence_record.title,
        recurrence_record.description,
        recurrence_record.priority,
        next_due_date,
        recurrence_record.ticket_octa,
        recurrence_record.status_id,
        recurrence_record.assigned_to,
        recurrence_record.created_by,
        recurrence_record.oportunidade_id,
        recurrence_record.tags,
        recurrence_record.is_private,
        recurrence_record.id,
        next_occurrence_number
      )
      ON CONFLICT (recurrence_id, recurrence_occurrence)
      WHERE recurrence_id IS NOT NULL AND recurrence_occurrence IS NOT NULL
      DO NOTHING
      RETURNING id INTO inserted_ticket_id;

      IF inserted_ticket_id IS NOT NULL THEN
        generated_count := generated_count + 1;
      END IF;

      recurrence_record.generated_occurrences := next_occurrence_number;
      recurrence_record.next_occurrence_date := public.add_ticket_recurrence_interval(
        next_due_date,
        recurrence_record.frequency,
        recurrence_record.interval
      );

      IF recurrence_record.end_type = 'ON_DATE'
        AND recurrence_record.next_occurrence_date > recurrence_record.end_date THEN
        recurrence_record.is_active := false;
        recurrence_record.next_occurrence_date := NULL;
      ELSIF recurrence_record.end_type = 'AFTER_COUNT'
        AND recurrence_record.generated_occurrences >= recurrence_record.occurrence_limit THEN
        recurrence_record.is_active := false;
        recurrence_record.next_occurrence_date := NULL;
      END IF;
    END LOOP;

    UPDATE public.omnia_ticket_recurrences
    SET generated_occurrences = recurrence_record.generated_occurrences,
        next_occurrence_date = recurrence_record.next_occurrence_date,
        is_active = recurrence_record.is_active
    WHERE id = recurrence_record.id;
  END LOOP;

  RETURN generated_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_omnia_ticket_recurrences(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_omnia_ticket_recurrences(date) TO service_role;
