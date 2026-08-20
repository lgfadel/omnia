#!/usr/bin/env bash
set -euo pipefail

command="${1:-up}"
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
environment_root="$repo_root/.context/local-test-env"
supabase_root="$environment_root/supabase"
container_name="supabase_db_omnia-local-test"
test_email="admin@omnia.local"
test_password="senha-local-omnia"

ensure_dependencies() {
  command -v supabase >/dev/null || { echo 'Supabase CLI não encontrado.' >&2; exit 1; }
  command -v docker >/dev/null || { echo 'Docker não encontrado.' >&2; exit 1; }
  command -v curl >/dev/null || { echo 'curl não encontrado.' >&2; exit 1; }
  command -v node >/dev/null || { echo 'Node.js não encontrado.' >&2; exit 1; }
}

load_local_env() {
  eval "$(supabase status --workdir "$environment_root" --output env)"
}

run_sql_file() {
  docker exec -i "$container_name" psql -v ON_ERROR_STOP=1 -U postgres -d postgres < "$1"
}

provision() {
  ensure_dependencies
  mkdir -p "$supabase_root"
  cp "$repo_root/supabase/local-fixtures/config.toml" "$supabase_root/config.toml"
  supabase start --workdir "$environment_root"
  load_local_env
  run_sql_file "$repo_root/supabase/local-fixtures/malotes-core.sql"
  run_sql_file "$repo_root/supabase/local-fixtures/app-core.sql"
  malote_schema_present="$(docker exec "$container_name" psql -At -U postgres -d postgres -c "SELECT to_regclass('public.omnia_malote_settings') IS NOT NULL")"
  if [[ "$malote_schema_present" != 't' ]]; then
    run_sql_file "$repo_root/supabase/migrations/20260820150724_create_malotes_digitais.sql"
  else
    docker exec "$container_name" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "GRANT SELECT, INSERT, UPDATE, DELETE ON public.omnia_malote_settings, public.omnia_malote_batches, public.omnia_malote_items, public.omnia_malote_attempts TO service_role"
  fi

  existing_auth_user_id="$(docker exec "$container_name" psql -At -U postgres -d postgres -c "SELECT id FROM auth.users WHERE email = '$test_email' LIMIT 1")"
  if [[ -z "$existing_auth_user_id" ]]; then
    response="$(curl --fail-with-body --silent --show-error -X POST "$API_URL/auth/v1/admin/users" -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" -H 'Content-Type: application/json' --data "{\"email\":\"$test_email\",\"password\":\"$test_password\",\"email_confirm\":true}")"
    existing_auth_user_id="$(node -e 'const input = JSON.parse(process.argv[1]); process.stdout.write(input.id)' "$response")"
  fi

  docker exec -i "$container_name" psql -v ON_ERROR_STOP=1 -U postgres -d postgres <<SQL
INSERT INTO public.omnia_users (auth_user_id, name, email, roles, color)
VALUES ('$existing_auth_user_id', 'Admin Local', '$test_email', ARRAY['ADMIN'], '#2563EB')
ON CONFLICT (auth_user_id) DO UPDATE
SET name = EXCLUDED.name, email = EXCLUDED.email, roles = EXCLUDED.roles, color = EXCLUDED.color;

INSERT INTO public.omnia_user_permissions (user_id, menu_item_id, can_access, granted_by)
SELECT local_user.id, menu.id, true, local_user.id
FROM public.omnia_users local_user
CROSS JOIN public.omnia_menu_items menu
WHERE local_user.auth_user_id = '$existing_auth_user_id'
ON CONFLICT (user_id, menu_item_id) DO UPDATE SET can_access = EXCLUDED.can_access;

UPDATE public.omnia_malote_settings
SET recipient_email = 'malotes@local.test';
SQL

  printf '%s\n' \
    "NEXT_PUBLIC_SUPABASE_URL=\"$API_URL\"" \
    "NEXT_PUBLIC_SUPABASE_ANON_KEY=\"$ANON_KEY\"" \
    "SUPABASE_SERVICE_ROLE_KEY=\"$SERVICE_ROLE_KEY\"" \
    'MALOTE_SMTP_HOST="127.0.0.1"' \
    'MALOTE_SMTP_PORT="55425"' \
    'MALOTE_SMTP_SECURE="false"' \
    > "$repo_root/apps/web-next/.env.local"

  echo "Ambiente local pronto."
  echo "UI: http://localhost:3000"
  echo "Supabase Studio: $STUDIO_URL"
  echo "Mailpit: $INBUCKET_URL"
  echo "Login: $test_email / $test_password"
  echo "Inicie a UI com: npm run dev"
}

case "$command" in
  up) provision ;;
  status) supabase status --workdir "$environment_root" ;;
  down) supabase stop --workdir "$environment_root" ;;
  *) echo "Uso: $0 {up|status|down}" >&2; exit 1 ;;
esac
