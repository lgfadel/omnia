-- Aplicada em produção via dashboard, sem arquivo local correspondente.
-- Versão original em supabase_migrations.schema_migrations: 20251218031105
-- Arquivada antes do repair --status reverted que reconciliou o histórico.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'omnia_tickets'
      AND column_name = 'ticket'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'omnia_tickets'
      AND column_name = 'ticket_octa'
  ) THEN
    EXECUTE 'ALTER TABLE public.omnia_tickets RENAME COLUMN ticket TO ticket_octa';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'omnia_tickets'
      AND column_name = 'ticket_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.omnia_tickets ADD COLUMN ticket_id INTEGER';
  END IF;
END;
$$;

WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS rn
  FROM public.omnia_tickets
)
UPDATE public.omnia_tickets t
SET ticket_id = COALESCE(t.ticket_id, n.rn)
FROM numbered n
WHERE t.id = n.id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.omnia_tickets WHERE ticket_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Não foi possível preencher ticket_id para todos os registros (ainda existem NULLs)';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'omnia_tickets_ticket_id_unique'
  ) THEN
    EXECUTE 'ALTER TABLE public.omnia_tickets ADD CONSTRAINT omnia_tickets_ticket_id_unique UNIQUE (ticket_id)';
  END IF;
END;
$$;

ALTER TABLE public.omnia_tickets
ALTER COLUMN ticket_id SET NOT NULL;

CREATE SEQUENCE IF NOT EXISTS public.omnia_tickets_ticket_id_seq;

SELECT setval(
  'public.omnia_tickets_ticket_id_seq',
  COALESCE((SELECT MAX(ticket_id) FROM public.omnia_tickets), 0)
);

CREATE OR REPLACE FUNCTION public.set_omnia_tickets_ticket_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ticket_id IS NULL THEN
    NEW.ticket_id := nextval('public.omnia_tickets_ticket_id_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_omnia_tickets_ticket_id_trigger ON public.omnia_tickets;

CREATE TRIGGER set_omnia_tickets_ticket_id_trigger
BEFORE INSERT ON public.omnia_tickets
FOR EACH ROW
EXECUTE FUNCTION public.set_omnia_tickets_ticket_id();

CREATE INDEX IF NOT EXISTS idx_omnia_tickets_ticket_id
ON public.omnia_tickets(ticket_id);
