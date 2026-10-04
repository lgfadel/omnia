#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../.."
container=omnia-tasks-api-test
# This runner never connects to a configured Supabase project or reads .env.
if ! docker inspect "$container" >/dev/null 2>&1; then
  docker run -d --name "$container" -p 127.0.0.1:55432:5432 -e POSTGRES_PASSWORD=omnia_tasks_test_only public.ecr.aws/supabase/postgres:17.6.1.166 >/dev/null
fi
for attempt in {1..30}; do
  if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec -i "$container" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < supabase/tests/tasks-api/baseline.sql >/dev/null
if [[ "${1:-}" != '--baseline-only' ]]; then
  docker exec -i "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/migrations/20261002223637_tasks_api_transactional_security.sql >/dev/null
fi
docker exec -i "$container" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < supabase/tests/tasks-api/regression.sql
if [[ "${1:-}" != '--baseline-only' ]]; then
  mkdir -p .context/tasks-api-mcp
  # Two real PostgreSQL connections race the same principal, operation and key.
  for connection in 1 2; do
    docker exec -i "$container" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 > ".context/tasks-api-mcp/sql-concurrency-$connection.log" <<'SQL' &
BEGIN;
SET LOCAL ROLE service_role;
SELECT public.tasks_api_dispatch('tasks.create','{"title":"Concurrent retry"}','20000000-0000-0000-0000-000000000001',NULL,'concurrent-retry');
SELECT pg_sleep(0.2);
COMMIT;
SQL
    pids[$connection]=$!
  done
  for connection in 1 2; do wait "${pids[$connection]}"; done
  docker exec -i "$container" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 <<'SQL'
SELECT public.test_assert((SELECT count(*) FROM public.omnia_tickets WHERE title='Concurrent retry')=1,'concurrent retries create one task');
SELECT public.test_assert((SELECT count(*) FROM tasks_api_private.audit a JOIN public.omnia_tickets t ON a.resource_id=t.id WHERE t.title='Concurrent retry')=1,'concurrent retries create one audit entry');
SQL
fi
