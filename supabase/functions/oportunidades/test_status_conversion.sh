#!/bin/bash

# Script para testar a conversão de status (nome para UUID) na Edge Function
# Execute este script para verificar se a conversão está funcionando

echo "🧪 TESTE: Conversão de Status (Nome para UUID)"
echo "=============================================="

# Configurações - SUBSTITUA pelos valores corretos
SUPABASE_URL="https://your-project.supabase.co"
ANON_KEY="your-anon-key"
SERVICE_ROLE_KEY="your-service-role-key"

echo ""
echo "📋 INSTRUÇÕES:"
echo "1. Substitua SUPABASE_URL, ANON_KEY e SERVICE_ROLE_KEY pelos valores corretos"
echo "2. Execute este script para testar a conversão de status"
echo ""

echo "🔍 TESTE 1: POST com nome do status (Prospecto)"
echo "----------------------------------------------"
curl -X POST \
  "${SUPABASE_URL}/functions/v1/oportunidades" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "cliente": "Teste Conversão Status",
    "status": "Prospecto",
    "numero_unidades": 50,
    "valor_proposta": 15000,
    "sindico_email": "teste@exemplo.com",
    "cep": "01234-567"
  }' \
  -w "\nStatus: %{http_code}\n" \
  -s

echo ""
echo "🔍 TESTE 2: POST com UUID do status (deve funcionar também)"
echo "----------------------------------------------------------"
curl -X POST \
  "${SUPABASE_URL}/functions/v1/oportunidades" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "cliente": "Teste UUID Status",
    "status": "uuid-do-status-prospecto",
    "numero_unidades": 30,
    "valor_proposta": 12000,
    "sindico_email": "teste2@exemplo.com",
    "cep": "01234-567"
  }' \
  -w "\nStatus: %{http_code}\n" \
  -s

echo ""
echo "🔍 TESTE 3: POST com status inválido (deve retornar erro)"
echo "--------------------------------------------------------"
curl -X POST \
  "${SUPABASE_URL}/functions/v1/oportunidades" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "cliente": "Teste Status Inválido",
    "status": "StatusInexistente",
    "numero_unidades": 20,
    "valor_proposta": 8000,
    "sindico_email": "teste3@exemplo.com",
    "cep": "01234-567"
  }' \
  -w "\nStatus: %{http_code}\n" \
  -s

echo ""
echo "🔍 TESTE 4: PUT com nome do status (atualização)"
echo "-----------------------------------------------"
echo "Primeiro, obtenha o ID de uma oportunidade existente e substitua 'ID_DA_OPORTUNIDADE'"
echo ""
curl -X PUT \
  "${SUPABASE_URL}/functions/v1/oportunidades/ID_DA_OPORTUNIDADE" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "Em Negociação",
    "valor_proposta": 18000
  }' \
  -w "\nStatus: %{http_code}\n" \
  -s

echo ""
echo "✅ RESULTADOS ESPERADOS:"
echo "- TESTE 1: Status 200/201 - Oportunidade criada com status convertido"
echo "- TESTE 2: Status 200/201 - Oportunidade criada com UUID direto"
echo "- TESTE 3: Status 400 - Erro 'Status inválido'"
echo "- TESTE 4: Status 200 - Oportunidade atualizada com status convertido"
echo ""
echo "🔍 Para verificar se a conversão funcionou:"
echo "1. Consulte o banco de dados e verifique se o campo 'status' contém UUIDs"
echo "2. Execute GET para listar as oportunidades criadas"
echo ""
echo "📝 NOTAS:"
echo "- Certifique-se de que existem registros na tabela 'omnia_crm_statuses'"
echo "- Os nomes dos status devem corresponder exatamente aos registros da tabela"
echo "- Substitua 'ID_DA_OPORTUNIDADE' no TESTE 4 por um ID real"