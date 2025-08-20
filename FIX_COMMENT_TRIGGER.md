# Correção do Erro de Trigger de Comentários

## Problema Identificado

O erro `record "new" has no field "ticket_id"` está acontecendo porque existe um trigger incorreto na tabela `omnia_comments` que está tentando acessar o campo `ticket_id`, mas essa tabela é para comentários de atas e usa o campo `ata_id`.

## Causa

A migração `20250819211723_2ba62ddf-a416-476f-9611-a6878f00e706.sql` criou um trigger `update_ticket_comment_count` na tabela `omnia_comments` (atas) quando deveria estar na tabela `omnia_ticket_comments` (tickets).

## Solução

Execute o seguinte SQL no painel do Supabase para corrigir o problema:

```sql
-- Remove trigger incorreto da tabela omnia_comments
DROP TRIGGER IF EXISTS update_ticket_comment_count ON public.omnia_comments;
DROP FUNCTION IF EXISTS public.update_ticket_comment_count();
```

## Verificação

Após executar o SQL acima:

1. Teste adicionar um comentário em uma ata
2. O erro `record "new" has no field "ticket_id"` não deve mais aparecer
3. Os comentários de tickets continuarão funcionando normalmente (eles usam o trigger correto na tabela `omnia_ticket_comments`)

## Estrutura Correta

- **Comentários de Atas**: Tabela `omnia_comments` com campo `ata_id`
- **Comentários de Tickets**: Tabela `omnia_ticket_comments` com campo `ticket_id`
- **Trigger de Tickets**: Deve estar apenas na tabela `omnia_ticket_comments`