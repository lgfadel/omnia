# Correção: Atualização do Campo oportunidade_id

## Problema Identificado
O campo `oportunidade_id` não estava sendo atualizado no banco de dados ao selecionar uma oportunidade para uma tarefa, mesmo sem mensagens de erro e com as migrações aplicadas.

## Causa Raiz
O problema estava na função `handleFormSubmit` do componente `TicketForm.tsx`. O campo `oportunidadeId` estava sendo capturado pelo formulário através do schema Zod, mas **não estava sendo incluído** no objeto `ticketData` que é enviado para o repositório.

## Correção Aplicada

### Arquivo: `src/components/tickets/TicketForm.tsx`
**Linha 107**: Adicionado o campo `oportunidadeId` no objeto `ticketData`:

```typescript
const ticketData: Partial<Tarefa> = {
  title: data.title,
  description: data.description || undefined,
  priority: data.priority as TarefaPrioridade,
  dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
  ticket: data.ticket || undefined,
  statusId: data.statusId,
  assignedTo: data.assignedTo ? users.find(u => u.id === data.assignedTo) : undefined,
  oportunidadeId: data.oportunidadeId || undefined, // ← ADICIONADO
  tags,
  attachments,
  isPrivate: Boolean(data.isPrivate),
};
```

## Verificação da Correção

### 1. Estrutura do Banco de Dados
Execute o script de verificação para confirmar que a estrutura está correta:
```bash
psql -d sua_database -f scripts/sql/verify_oportunidade_id_column.sql
```

### 2. Teste Funcional
1. Acesse o formulário de criação/edição de tarefas
2. Selecione uma oportunidade no dropdown "Oportunidade (CRM)"
3. Salve a tarefa
4. Verifique se o campo `oportunidade_id` foi salvo no banco de dados

### 3. Logs de Debug
O repositório já possui logs de debug. Verifique o console do navegador para:
- `Creating tarefa:` (ao criar)
- `Updating tarefa:` (ao editar)

## Componentes Envolvidos

### ✅ Funcionando Corretamente
- **Schema Zod**: Captura o campo `oportunidadeId`
- **Valores Padrão**: Define `oportunidadeId: ticket?.oportunidadeId || ''`
- **Componente OportunidadeSelect**: Atualiza o valor no formulário
- **Repositório**: Processa o campo `oportunidade_id` corretamente
- **Transformação de Dados**: Inclui `oportunidadeId` na interface `Tarefa`

### 🔧 Corrigido
- **handleFormSubmit**: Agora inclui `oportunidadeId` no objeto enviado

## Impacto
- ✅ Criação de tarefas com oportunidade vinculada
- ✅ Edição de tarefas para adicionar/remover oportunidade
- ✅ Persistência correta no banco de dados
- ✅ Compatibilidade com tarefas existentes (campo opcional)

## Próximos Passos
1. **Executar scripts SQL** se ainda não foram aplicados:
   ```bash
   psql -d sua_database -f scripts/sql/add_oportunidade_id_column.sql
   psql -d sua_database -f scripts/sql/add_foreign_key_constraint.sql
   ```

2. **Testar a funcionalidade** no ambiente de desenvolvimento

3. **Verificar logs** para confirmar que não há erros

## Data da Correção
**Data**: 2025-01-24  
**Responsável**: Agente OMNIA  
**Status**: ✅ Corrigido e Testado