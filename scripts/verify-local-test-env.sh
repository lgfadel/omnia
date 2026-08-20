#!/usr/bin/env bash
set -euo pipefail

container_name="supabase_db_omnia-local-test"
required_tables=(
  omnia_users omnia_menu_items omnia_role_permissions omnia_user_permissions
  omnia_condominiums omnia_administradoras omnia_tags omnia_crm_origens
  omnia_statuses omnia_atas omnia_ticket_statuses omnia_tickets
  omnia_admissao_statuses omnia_admissoes omnia_rescisao_statuses omnia_rescisoes
  omnia_balancetes omnia_crm_leads omnia_protocolos omnia_notifications
  omnia_admissao_comments omnia_rescisao_comments omnia_ata_transcription_jobs
  omnia_malote_settings omnia_malote_batches omnia_malote_items
)

docker inspect "$container_name" >/dev/null
command -v curl >/dev/null
command -v node >/dev/null
command -v supabase >/dev/null

for table in "${required_tables[@]}"; do
  present="$(docker exec "$container_name" psql -At -U postgres -d postgres -c "SELECT to_regclass('public.$table') IS NOT NULL")"
  [[ "$present" == t ]] || { echo "Tabela ausente: $table" >&2; exit 1; }
done

for table in omnia_atas omnia_tickets omnia_admissoes omnia_rescisoes omnia_balancetes omnia_crm_leads omnia_protocolos omnia_notifications; do
  count="$(docker exec "$container_name" psql -At -U postgres -d postgres -c "SELECT count(*) FROM public.$table")"
  [[ "$count" -gt 0 ]] || { echo "Sem dados dummy: $table" >&2; exit 1; }
done

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
eval "$(supabase status --workdir "$repo_root/.context/local-test-env" --output env)"
auth_response="$(curl --silent --show-error --fail-with-body -X POST "$API_URL/auth/v1/token?grant_type=password" -H "apikey: $ANON_KEY" -H 'Content-Type: application/json' --data '{"email":"admin@omnia.local","password":"senha-local-omnia"}')"
access_token="$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).access_token)' "$auth_response")"

api_get() {
  curl --silent --show-error --fail-with-body "$API_URL/rest/v1/$1" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $access_token"
}

permissions="$(api_get 'omnia_user_permissions?select=id,can_access,menu_item:omnia_menu_items(name,path)&can_access=eq.true')"
dashboard="$(api_get 'omnia_atas?select=id,title,status:omnia_statuses(name),secretary:omnia_users!omnia_atas_secretary_id_fkey(name),responsible:omnia_users!omnia_atas_responsible_id_fkey(name)')"
tickets="$(api_get 'omnia_tickets?select=id,title,status:omnia_ticket_statuses(name),assigned_to_user:omnia_users!omnia_tickets_assigned_to_fkey(name)')"
rescisoes="$(api_get 'omnia_rescisoes?select=id,title,assigned_to_user:omnia_users!omnia_demissoes_assigned_to_fkey(name),created_by_user:omnia_users!omnia_demissoes_created_by_fkey(name)')"

node -e '
const [permissions, dashboard, tickets, rescisoes] = process.argv.slice(1).map(JSON.parse)
if (permissions.length < 8) throw new Error(`permissões insuficientes: ${permissions.length}`)
if (dashboard.length < 1) throw new Error("dashboard sem atas dummy")
if (tickets.length < 1) throw new Error("dashboard sem tarefas dummy")
if (rescisoes.length < 1) throw new Error("baseline sem rescisões dummy")
console.log(`Baseline local verificado: ${permissions.length} permissões, ${dashboard.length} atas, ${tickets.length} tarefas e ${rescisoes.length} rescisões.`)
' "$permissions" "$dashboard" "$tickets" "$rescisoes"
