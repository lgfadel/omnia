#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
notification_test_container="omnia-comment-notifications-$$"
trap 'docker stop "$notification_test_container" >/dev/null 2>&1 || true' EXIT
docker run --rm -d --name "$notification_test_container" --network none -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17-alpine >/dev/null
for attempt in {1..50}; do
  if docker exec "$notification_test_container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then break; fi
  sleep 0.2
done
{
  cat supabase/tests/comment-notifications/fixture.sql
  awk '/-- Wake the worker/{exit} {print}' supabase/migrations/20261027133816_web_push_notifications.sql
  cat supabase/migrations/20261027145928_web_push_context.sql
  cat supabase/migrations/20261027150709_new_comment_notifications.sql
  cat supabase/tests/comment-notifications/check.sql
} | docker exec -i "$notification_test_container" psql -U postgres -v ON_ERROR_STOP=1 -q
