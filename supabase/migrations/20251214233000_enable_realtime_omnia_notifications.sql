DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'omnia_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.omnia_notifications;
  END IF;
END $$;
