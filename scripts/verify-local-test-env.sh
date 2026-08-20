#!/usr/bin/env bash
set -euo pipefail

container_name="supabase_db_omnia-local-test"
required_tables=(
  omnia_users omnia_menu_items omnia_role_permissions omnia_user_permissions
  omnia_condominiums omnia_administradoras omnia_tags omnia_crm_origens
)

docker inspect "$container_name" >/dev/null

for table in "${required_tables[@]}"; do
  present="$(docker exec "$container_name" psql -At -U postgres -d postgres -c "SELECT to_regclass('public.$table') IS NOT NULL")"
  [[ "$present" == t ]] || { echo "Tabela ausente: $table" >&2; exit 1; }
done

echo "Schema compartilhado local verificado."
