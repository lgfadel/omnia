# Arquitetura de Autenticação Simplificada - OMNIA

## Decisão Arquitetural

**Data:** Janeiro 2025  
**Status:** Implementado  
**Contexto:** Simplificação da autenticação do endpoint de oportunidades

## Problema

A arquitetura anterior de autenticação era complexa e causava problemas de acesso:
- Verificação de roles na tabela `omnia_users`
- Dependência de cadastro prévio do usuário
- Múltiplas verificações de permissões
- Complexidade desnecessária para casos de uso simples

## Solução Implementada

### Autenticação Simplificada

**Antes:**
```typescript
// Verificava token JWT + roles na tabela omnia_users
async function checkUserPermissions(supabaseClient, requiredRoles = ['ADMIN', 'SECRETARIO', 'USUARIO'])
```

**Depois:**
```typescript
// Apenas verifica se o token JWT é válido
async function checkUserPermissions(supabaseClient)
```

### Requisitos de Acesso

**Requisitos atuais:**
- Token JWT válido do Supabase Auth
- Usuário autenticado no sistema

**Removido:**
- ❌ Verificação de roles específicas
- ❌ Consulta à tabela `omnia_users`
- ❌ Cadastro prévio obrigatório

## Benefícios

1. **Simplicidade**: Redução significativa da complexidade
2. **Facilidade de uso**: Qualquer usuário autenticado pode acessar
3. **Menos pontos de falha**: Eliminação de dependências desnecessárias
4. **Manutenção**: Código mais simples de manter e debugar

## Impacto nos Endpoints

### Endpoint `/oportunidades`

**Autenticação:**
- ✅ Token JWT válido (Bearer)
- ✅ Usuário autenticado no Supabase

**Operações disponíveis:**
- GET - Listar oportunidades
- GET /{id} - Buscar por ID
- POST - Criar oportunidade
- PUT /{id} - Atualizar oportunidade
- DELETE /{id} - Excluir oportunidade

## Segurança

A segurança continua garantida através de:
- Autenticação obrigatória via JWT
- Validação de token pelo Supabase Auth
- Proteção contra SQL injection
- Headers CORS configurados
- Validação rigorosa de dados de entrada

## Migração

### Código Alterado
- `supabase/functions/oportunidades/index.ts` - Função `checkUserPermissions` simplificada
- `docs/api/oportunidades-endpoint.md` - Documentação atualizada

### Código Removido
- `docs/troubleshooting-auth.md` - Não mais necessário

### Compatibilidade
- ✅ Totalmente compatível com integrações existentes
- ✅ Não requer mudanças no frontend
- ✅ Não requer mudanças nas chamadas da API

## Considerações Futuras

Se no futuro for necessário implementar controle de acesso mais granular:
1. Pode ser adicionado como camada opcional
2. Manter a autenticação básica como padrão
3. Implementar verificações específicas apenas onde necessário

## Teste

Para testar o endpoint:

```bash
curl -X GET "https://[SEU_PROJETO].supabase.co/functions/v1/oportunidades" \
  -H "Authorization: Bearer [SEU_TOKEN_JWT]" \
  -H "Content-Type: application/json"
```

**Resultado esperado:** Acesso liberado para qualquer usuário com token JWT válido.