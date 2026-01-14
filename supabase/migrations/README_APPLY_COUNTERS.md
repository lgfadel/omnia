# Como Aplicar a Migration de Contadores de Admissões

## Problema
Os contadores de comentários e anexos na lista de admissões não estão refletindo os dados do banco.

## Solução
A migration `20250114000000_add_admissao_counters_triggers.sql` cria triggers automáticos para manter os contadores sempre atualizados.

## Como Aplicar

1. Acesse o Supabase Dashboard: https://supabase.com/dashboard/project/elmxwvimjxcswjbrzznq
2. Vá em **SQL Editor**
3. Copie e cole o conteúdo do arquivo `20250114000000_add_admissao_counters_triggers.sql`
4. Execute o SQL

## O que a Migration Faz

1. **Cria função `update_admissao_comment_count()`**: Atualiza o contador quando comentários são inseridos/deletados
2. **Cria função `update_admissao_attachment_count()`**: Atualiza o contador quando anexos são inseridos/deletados
3. **Cria triggers**: Executam as funções automaticamente após INSERT/DELETE
4. **Inicializa contadores**: Calcula e define os valores corretos para todas as admissões existentes

## Resultado Esperado

Após aplicar a migration:
- Os contadores serão inicializados com os valores corretos
- Novos comentários/anexos atualizarão os contadores automaticamente
- A lista de admissões mostrará os números corretos em tempo real
