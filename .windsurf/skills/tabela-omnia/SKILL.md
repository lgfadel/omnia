---
name: tabela-omnia
description: Criar tabelas de dados seguindo o padrão Omnia. Use quando o usuário pedir para criar funcionalidades com listagem de dados, CRUD com tabela, ou qualquer tela que exiba dados tabulares.
---

# Tabela Padrão Omnia

Skill para criar tabelas de dados seguindo o padrão visual e comportamental estabelecido na aplicação Omnia.

## Princípios Fundamentais

1. **SEMPRE usar `<TabelaOmnia />`** — nunca criar tabelas HTML manualmente
2. **Colunas são contextuais** — adaptar ao domínio (condomínios, tarefas, atas, etc.)
3. **Design é padronizado** — seguir exatamente o padrão visual da página de Tarefas
4. **Ações são adaptáveis** — View/Delete são padrão; adicionar outras (Printer, Download, etc.) conforme contexto

## Implementação de Referência

- **Página:** `apps/web-next/src/app/tarefas/page.tsx`
- **Componente:** `apps/web-next/src/components/ui/tabela-omnia.tsx`

## Estrutura Obrigatória da Página

```tsx
"use client";

import { Layout } from '@/components/layout/Layout';
import { BreadcrumbOmnia } from '@/components/ui/breadcrumb-omnia';
import { TabelaOmnia } from '@/components/ui/tabela-omnia';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Filter } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';

export default function EntityPage() {
  return (
    <Layout>
      <div className="space-y-6">
        {/* 1. Breadcrumb */}
        <BreadcrumbOmnia items={[{ label: "Entity Name", isActive: true }]} />

        {/* 2. Header: título + botão criar */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Entity Name</h1>
          <Button className="bg-primary hover:bg-primary/90 w-12 h-12 p-0 rounded-lg">
            <Plus className="w-5 h-5" />
          </Button>
        </div>

        {/* 3. Filtros */}
        <div className="bg-white rounded-lg border p-6 mb-6">
          {/* Search + filters adaptados ao contexto */}
        </div>

        {/* 4. Tabela */}
        <div className="bg-white rounded-lg border overflow-hidden">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              Carregando...
            </div>
          ) : (
            <TabelaOmnia
              columns={columns}
              data={data}
              onView={handleView}
              onDelete={handleDelete}
            />
          )}
        </div>
      </div>

      {/* 5. AlertDialog de confirmação */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        {/* ... */}
      </AlertDialog>
    </Layout>
  );
}
```

## Definição de Colunas (Contextual)

```tsx
// Adaptar ao contexto específico
const columns = [
  { key: "id", label: "#", width: "w-[8%]" },
  { key: "mainField", label: "Campo Principal", width: "w-[30%]" },
  { key: "sortableField", label: "Campo Ordenável", width: "w-[15%]", sortable: true },
  // ... outras colunas conforme necessidade
  { key: "statusId", label: "Status", width: "w-[15%]" }, // se aplicável
];
```

**Widths devem somar ~90%** (10% reservado para coluna de ações automática).

## Colunas com Renderização Automática

Use estas keys quando o contexto tiver dados equivalentes:

| Key | Renderização |
|---|---|
| `priority` | PriorityBadge com Flag colorido (URGENTE/ALTA/NORMAL/BAIXA) |
| `dueDate` | DueDateModal (popover com calendar) |
| `responsible` | Avatar circular + dropdown para mudar |
| `secretary` | Avatar circular + dropdown para mudar |
| `statusId` | Badge colorido + dropdown para mudar |
| `commentCount` | MessageCircle + contador clicável |
| `attachmentCount` | Paperclip + contador |
| `ticketOcta` | Código mono + Copy |
| `title` | Texto + tags + Lock se privado |

## Ações Customizadas

Para ações além de View/Delete, seguir o padrão:

```tsx
<Button
  variant="ghost"
  size="icon"
  className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-gray-100"
  onClick={(e) => { e.stopPropagation(); handleAction(row.id); }}
>
  <IconeLucide className="w-4 h-4" />
</Button>
```

**Ícones comuns:** Printer (imprimir), Download (exportar), Copy (duplicar), Archive (arquivar), Pencil (editar), Mail (email), Share2 (compartilhar)

## Padrão de Filtros

### Search (obrigatório)
```tsx
<div className="relative flex-1">
  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
  <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 h-10" />
</div>
```

### Dropdown de Status (se aplicável)
```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline" size="sm" className="h-10 px-3 bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100">
      <Filter className="w-4 h-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent className="w-56">
    <DropdownMenuCheckboxItem checked={allSelected} onCheckedChange={handleSelectAll} className="font-medium">
      Selecionar todos
    </DropdownMenuCheckboxItem>
    <DropdownMenuSeparator />
    {statuses.map((status) => (
      <DropdownMenuCheckboxItem key={status.id} checked={statusFilter.includes(status.id)} onCheckedChange={() => toggle(status.id)}>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: status.color }} />
          {status.name}
        </div>
      </DropdownMenuCheckboxItem>
    ))}
  </DropdownMenuContent>
</DropdownMenu>
```

## Agrupamento por Status (Opcional)

Se faz sentido agrupar por status, passar `grouped={true}` e estruturar dados:

```tsx
type GroupedDataItem = {
  type: 'separator' | 'data';
  statusName: string;
  statusColor?: string;
  data?: RowType;
  count?: number;
};
```

## Confirmação de Exclusão (Obrigatório)

```tsx
const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
const [itemToDelete, setItemToDelete] = useState<{ id: string; title: string } | null>(null);

const handleDelete = (id: string | number) => {
  const item = items.find(i => i.id === String(id));
  if (item) {
    setItemToDelete({ id: String(id), title: item.title || item.name });
    setDeleteConfirmOpen(true);
  }
};

const handleDeleteConfirm = async () => {
  if (itemToDelete) {
    await deleteItem(itemToDelete.id);
    setDeleteConfirmOpen(false);
    setItemToDelete(null);
  }
};
```

## Checklist de Entrega

- [ ] Usa `<Layout>` wrapper
- [ ] `<BreadcrumbOmnia>` no topo
- [ ] Header com `h1 text-3xl font-bold` + botão Plus 12×12
- [ ] Filtros em `bg-white rounded-lg border p-6`
- [ ] Search com ícone integrado
- [ ] Tabela em `bg-white rounded-lg border overflow-hidden`
- [ ] Usa `<TabelaOmnia>` — **nunca HTML table**
- [ ] Colunas definidas para o contexto específico
- [ ] Ações adaptadas (View/Delete + outras se necessário)
- [ ] Loading state com spinner
- [ ] AlertDialog de confirmação de exclusão
- [ ] `"use client"` no topo
- [ ] Ações customizadas seguem padrão: `variant="ghost" size="icon" h-8 w-8`

## Componentes Principais

- `TabelaOmnia` — `@/components/ui/tabela-omnia`
- `PriorityBadge` — `@/components/ui/priority-badge`
- `DueDateModal` — `@/components/ui/due-date-modal`
- `CommentsModal` — `@/components/ui/comments-modal`
- `BreadcrumbOmnia` — `@/components/ui/breadcrumb-omnia`

## Ícones Lucide Comuns

Plus, Search, Filter, Eye, Trash2, ChevronDown, ChevronRight, ChevronUp, User, Lock, Check, MessageCircle, Paperclip, Copy, Flag, Printer, Download, Archive, Pencil, Mail, Share2

## Classes CSS Chave

- Container filtros: `bg-white rounded-lg border p-6 mb-6`
- Container tabela: `bg-white rounded-lg border overflow-hidden`
- Header: `text-muted-foreground text-xs uppercase tracking-wide py-4 px-2`
- Linha: `hover:bg-gray-50 cursor-pointer h-12 border-b border-gray-100`
- Separador: `bg-gray-50 hover:bg-gray-100 cursor-pointer`
- Status badge: `text-white font-medium whitespace-nowrap text-[10px] px-2 py-1 rounded-md`
