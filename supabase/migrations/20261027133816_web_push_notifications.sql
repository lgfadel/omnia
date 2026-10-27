-- Each browser installation belongs to exactly one authenticated account.
CREATE TABLE public.omnia_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.omnia_users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE CHECK (length(endpoint) <= 2048),
  p256dh text NOT NULL CHECK (length(p256dh) <= 256),
  auth_key text NOT NULL CHECK (length(auth_key) <= 256),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.omnia_push_subscriptions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.omnia_push_subscriptions TO authenticated;
CREATE POLICY push_subscriptions_own ON public.omnia_push_subscriptions FOR ALL TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.omnia_users u WHERE u.id = user_id AND u.auth_user_id = auth.uid() AND u.active IS DISTINCT FROM false
  ));

-- One independently retryable job per destination. No client can access the queue.
CREATE TABLE public.omnia_push_jobs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  notification_id uuid NOT NULL REFERENCES public.omnia_notifications(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES public.omnia_push_subscriptions(id) ON DELETE CASCADE,
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notification_id, subscription_id)
);
ALTER TABLE public.omnia_push_jobs ENABLE ROW LEVEL SECURITY;
CREATE INDEX omnia_push_jobs_pending_idx ON public.omnia_push_jobs (available_at, id);

CREATE OR REPLACE FUNCTION public.omnia_enqueue_push() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.omnia_push_jobs(notification_id, subscription_id)
    SELECT NEW.id, s.id FROM public.omnia_push_subscriptions s WHERE s.user_id = NEW.user_id;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.omnia_enqueue_push() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER omnia_notification_enqueue_push AFTER INSERT ON public.omnia_notifications
  FOR EACH ROW EXECUTE FUNCTION public.omnia_enqueue_push();

CREATE OR REPLACE FUNCTION public.omnia_claim_push_jobs(batch_size integer DEFAULT 50)
RETURNS TABLE(job_id bigint, subscription_id uuid, endpoint text, p256dh text, auth_key text,
  notification_id uuid, ticket_id uuid, ata_id uuid, comment_id uuid, attempts integer)
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  WITH selected AS (
    SELECT j.id FROM public.omnia_push_jobs j
    WHERE j.available_at <= now() AND (j.locked_until IS NULL OR j.locked_until < now())
    ORDER BY j.id FOR UPDATE SKIP LOCKED LIMIT least(greatest(batch_size, 1), 100)
  ), claimed AS (
    UPDATE public.omnia_push_jobs j SET locked_until = now() + interval '5 minutes', attempts = j.attempts + 1
    FROM selected WHERE j.id = selected.id RETURNING j.*
  )
  SELECT j.id, s.id, s.endpoint, s.p256dh, s.auth_key, n.id, n.ticket_id,
    coalesce(n.ata_id, c.ata_id), n.comment_id, j.attempts
  FROM claimed j JOIN public.omnia_push_subscriptions s ON s.id = j.subscription_id
    JOIN public.omnia_notifications n ON n.id = j.notification_id
    LEFT JOIN public.omnia_comments c ON c.id = n.comment_id;
$$;
REVOKE ALL ON FUNCTION public.omnia_claim_push_jobs(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.omnia_claim_push_jobs(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.omnia_finish_push_job(job bigint, result text, error_message text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE sub uuid;
BEGIN
  IF result = 'invalid' THEN
    SELECT subscription_id INTO sub FROM public.omnia_push_jobs WHERE id = job;
    DELETE FROM public.omnia_push_subscriptions WHERE id = sub;
  ELSIF result = 'sent' THEN
    DELETE FROM public.omnia_push_jobs WHERE id = job;
  ELSIF result = 'retry' THEN
    UPDATE public.omnia_push_jobs SET locked_until = NULL,
      available_at = now() + make_interval(mins => least(60, power(2, least(attempts, 6))::integer)),
      last_error = left(error_message, 500) WHERE id = job;
  ELSE RAISE EXCEPTION 'invalid result';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.omnia_finish_push_job(bigint, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.omnia_finish_push_job(bigint, text, text) TO service_role;

-- Wake the worker after commit. The durable queue and cron handle missed wakes.
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE SCHEMA IF NOT EXISTS private;
CREATE OR REPLACE FUNCTION private.omnia_wake_push_worker() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE project_url text; worker_secret text;
BEGIN
  SELECT decrypted_secret INTO project_url FROM vault.decrypted_secrets WHERE name = 'push_project_url';
  SELECT decrypted_secret INTO worker_secret FROM vault.decrypted_secrets WHERE name = 'push_worker_secret';
  IF project_url IS NOT NULL AND worker_secret IS NOT NULL THEN
    PERFORM net.http_post(
      url := project_url || '/functions/v1/send-web-push',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-worker-secret', worker_secret),
      body := '{}'::jsonb, timeout_milliseconds := 150000
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Unable to wake push worker: %', SQLSTATE;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.omnia_wake_push_worker() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER omnia_push_job_wake AFTER INSERT ON public.omnia_push_jobs
  FOR EACH ROW EXECUTE FUNCTION private.omnia_wake_push_worker();
