# Plano: Implementação de Número de Identificação de Tarefas (ticket_id)

## Objetivo
Criar um número de identificação sequencial visível para tarefas (`ticket_id`) que facilite a comunicação entre usuários, substituindo o UUID interno como referência.

## Análise Atual

### Estrutura da Tabela `omnia_tickets`
- **id**: UUID (chave primária interna)
- **ticket**: TEXT (referência a ticket de sistema externo - Octa)
- **title**, **description**, **priority**, **due_date**, **status_id**, etc.

### Alterações Necessárias
1. **Renomear** `ticket` → `ticket_octa` (manter referência ao sistema externo)
2. **Criar** `ticket_id` (INTEGER) - número sequencial interno

### Arquivos Impactados
- `apps/web-next/src/repositories/tarefasRepo.supabase.ts` - Repository de tarefas
- `apps/web-next/src/app/tarefas/page.tsx` - Lista de tarefas
- `apps/web-next/src/app/tarefas/[id]/page.tsx` - Detalhes da tarefa

---

## Fases de Implementação

### Fase 1: Migration do Banco de Dados
**Arquivo**: `supabase/migrations/YYYYMMDDHHMMSS_add_ticket_id.sql`

1. **Renomear coluna `ticket` para `ticket_octa`**
2. **Adicionar coluna `ticket_id`**
   - Tipo: `INTEGER`
   - Constraint: `UNIQUE NOT NULL`
   - Índice para performance

3. **Popular registros existentes**
   - Ordenar por `created_at ASC`
   - Numerar sequencialmente a partir de 1

4. **Criar sequence para novos tickets**
   - Iniciar do próximo número após o maior existente
   - Trigger para auto-atribuir em INSERT

```sql
-- Renomear coluna ticket para ticket_octa
ALTER TABLE public.omnia_tickets 
RENAME COLUMN ticket TO ticket_octa;

-- Adicionar coluna ticket_id
ALTER TABLE public.omnia_tickets 
ADD COLUMN ticket_id INTEGER;

-- Popular existentes ordenados por created_at
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as rn
  FROM public.omnia_tickets
)
UPDATE public.omnia_tickets t
SET ticket_id = n.rn
FROM numbered n
WHERE t.id = n.id;

-- Adicionar constraint NOT NULL e UNIQUE
ALTER TABLE public.omnia_tickets 
ALTER COLUMN ticket_id SET NOT NULL;

ALTER TABLE public.omnia_tickets 
ADD CONSTRAINT omnia_tickets_ticket_id_unique UNIQUE (ticket_id);

-- Criar sequence
CREATE SEQUENCE IF NOT EXISTS omnia_tickets_ticket_id_seq;

-- Definir valor inicial da sequence
SELECT setval('omnia_tickets_ticket_id_seq', COALESCE((SELECT MAX(ticket_id) FROM public.omnia_tickets), 0));

-- Criar função para auto-atribuir ticket_id
CREATE OR REPLACE FUNCTION public.set_ticket_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ticket_id IS NULL THEN
    NEW.ticket_id := nextval('omnia_tickets_ticket_id_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger
CREATE TRIGGER set_ticket_id_trigger
BEFORE INSERT ON public.omnia_tickets
FOR EACH ROW
EXECUTE FUNCTION public.set_ticket_id();

-- Índice para busca por ticket_id
CREATE INDEX idx_omnia_tickets_ticket_id ON public.omnia_tickets(ticket_id);
```

---

### Fase 2: Atualização do Repository TypeScript
**Arquivo**: `apps/web-next/src/repositories/tarefasRepo.supabase.ts`

1. Renomear `ticket` → `ticketOcta` na interface `Tarefa`
2. Adicionar `ticketId` à interface `Tarefa`
3. Atualizar `transformTarefaFromDB` para mapear ambos os campos
4. Não incluir `ticket_id` no `create` (será auto-gerado)

```typescript
// Interface Tarefa
export interface Tarefa {
  // ... campos existentes
  ticketOcta?: string;  // Renomeado de ticket
  ticketId: number;     // NOVO - número sequencial
}

// Transform
function transformTarefaFromDB(dbTarefa: any): Tarefa {
  return {
    // ... campos existentes
    ticketOcta: dbTarefa.ticket_octa,
    ticketId: dbTarefa.ticket_id,
  };
}
```

---

### Fase 3: Atualização da Lista de Tarefas
**Arquivo**: `apps/web-next/src/app/tarefas/page.tsx`

1. Substituir exibição do campo `ticket` por `ticketId`
2. Formatar como `#123` para fácil identificação
3. Permitir busca por número do ticket

```typescript
// Coluna na tabela
{ key: "ticketId", label: "Nº", width: "w-[8%]" }

// Exibição formatada
ticketId: `#${tarefa.ticketId}`

// Busca
task.ticketId?.toString().includes(query)
```

---

### Fase 4: Atualização da Página de Detalhes
**Arquivo**: `apps/web-next/src/app/tarefas/[id]/page.tsx`

1. Exibir `#ticketId` no título/header
2. Facilitar cópia do número para comunicação

---

## Checklist de Implementação

- [ ] Criar migration SQL
- [ ] Aplicar migration no Supabase
- [ ] Atualizar interface `Tarefa` no repository (ticket → ticketOcta, adicionar ticketId)
- [ ] Atualizar `transformTarefaFromDB`
- [ ] Atualizar colunas da tabela em `page.tsx`
- [ ] Atualizar transformação de dados para exibição
- [ ] Atualizar busca para incluir ticket_id
- [ ] Atualizar página de detalhes
- [ ] Testar criação de nova tarefa (auto-numeração)
- [ ] Testar exibição na lista
- [ ] Testar busca por número

---

## Considerações

### Campos
- **ticket_id**: Número sequencial interno (INTEGER, auto-gerado)
- **ticket_octa**: Referência a ticket do sistema Octa (TEXT, opcional)

### Formato Sugerido
- Exibição: `#1`, `#2`, `#123`
- Busca: aceitar com ou sem `#`

### Rollback
Se necessário reverter:
```sql
DROP TRIGGER IF EXISTS set_ticket_id_trigger ON public.omnia_tickets;
DROP FUNCTION IF EXISTS public.set_ticket_id();
DROP SEQUENCE IF EXISTS omnia_tickets_ticket_id_seq;
ALTER TABLE public.omnia_tickets DROP COLUMN ticket_id;
ALTER TABLE public.omnia_tickets RENAME COLUMN ticket_octa TO ticket;
```
