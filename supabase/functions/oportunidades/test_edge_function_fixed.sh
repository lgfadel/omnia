#!/bin/bash

# Script para testar a Edge Function após correção RLS
# Execute este script para verificar se a correção funcionou

echo "🧪 TESTE: Edge Function após correção RLS"
echo "=========================================="

# Configurações
SUPABASE_URL="https://your-project.supabase.co"
ANON_KEY="your-anon-key"
SERVICE_ROLE_KEY="your-service-role-key"

echo ""
echo "📋 INSTRUÇÕES:"
echo "1. Substitua SUPABASE_URL, ANON_KEY e SERVICE_ROLE_KEY pelos valores corretos"
echo "2. Execute este script para testar ambos os tokens"
echo ""

echo "🔍 TESTE 1: Com ANON_KEY (deve funcionar agora)"
echo "----------------------------------------------"
curl -X GET \
  "${SUPABASE_URL}/functions/v1/oportunidades" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n" \
  -s

echo ""
echo "🔍 TESTE 2: Com SERVICE_ROLE_KEY (deve funcionar)"
echo "------------------------------------------------"
curl -X GET \
  "${SUPABASE_URL}/functions/v1/oportunidades" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n" \
  -s

echo ""
echo "🔍 TESTE 3: Com limite (verificar paginação)"
echo "--------------------------------------------"
curl -X GET \
  "${SUPABASE_URL}/functions/v1/oportunidades?limit=2" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n" \
  -s

echo ""
echo "✅ RESULTADO ESPERADO:"
echo "- Todos os testes devem retornar Status: 200"
echo "- Deve retornar dados da tabela omnia_crm_leads"
echo "- Não deve mais retornar array vazio []"
echo ""
echo "🔧 SE AINDA HOUVER PROBLEMAS:"
echo "- Verifique se as variáveis de ambiente estão corretas"
echo "- Confirme se a Edge Function foi deployada"
echo "- Verifique os logs da Edge Function no Supabase Dashboard"