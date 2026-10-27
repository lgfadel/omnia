-- Recovery only: new queue entries wake the worker immediately.
SELECT cron.schedule('omnia-web-push-recovery', '* * * * *', $cron$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'push_project_url') || '/functions/v1/send-web-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-worker-secret',
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'push_worker_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  )
  WHERE EXISTS (SELECT 1 FROM public.omnia_push_jobs WHERE available_at <= now() AND (locked_until IS NULL OR locked_until < now()))
    AND EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'push_project_url')
    AND EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'push_worker_secret');
$cron$);
