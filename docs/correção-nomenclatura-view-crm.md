# Correção de Nomenclatura - View CRM

## Problema Identificado

A view `crm_lead_comment_counts` não seguia o padrão de nomenclatura das outras tabelas e objetos do OMNIA, que utilizam o prefixo `omnia_`.

## Padrão de Nomenclatura OMNIA

Todas as tabelas e objetos do sistema seguem o padrão:
- `omnia_users`
- `omnia_crm_leads`
- `omnia_crm_comments`
- `omnia_crm_attachments`
- `omnia_tickets`
- `omnia_condominiums`
- etc.

## Correção Aplicada

### 1. Migração Criada
- **Arquivo**: `supabase/migrations/20250115000000_fix_crm_view_nomenclature.sql`
- **Ação**: Renomeia `crm_lead_comment_counts` para `omnia_crm_lead_comment_counts`

### 2. Script Auxiliar Atualizado
- **Arquivo**: `scripts/crm_comments_attachments.sql`
- **Ação**: Atualizada a definição da view para usar o nome correto

## Impacto

- ✅ **Sem impacto no código**: A view não é referenciada diretamente no código TypeScript/JavaScript
- ✅ **Consistência**: Agora segue o padrão de nomenclatura do OMNIA
- ✅ **Funcionalidade**: Mantém a mesma funcionalidade (contagem de comentários por lead)

## Arquivos Modificados

1. `supabase/migrations/20250115000000_fix_crm_view_nomenclature.sql` (criado)
2. `scripts/crm_comments_attachments.sql` (atualizado)

## Próximos Passos

1. Aplicar a migração no ambiente de desenvolvimento
2. Testar se a funcionalidade de contagem de comentários continua funcionando
3. Aplicar em produção quando aprovado

---

**Data**: Janeiro 2025  
**Responsável**: Agente OMNIA  
**Status**: Implementado