# Plano de Implementação: Controle de Admissões de Funcionários

> **Baseado em**: Módulo de Tarefas existente (`omnia_tickets`)
> **Data**: 13/01/2026
> **Branch sugerido**: `feat/controle-admissoes`

---

## Visão Geral

Criar um novo módulo para controle de admissões de funcionários, replicando a estrutura técnica do módulo de Tarefas existente, com status específicos para o fluxo de admissão.

### Colunas da Tabela Principal
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| ID | uuid | Identificador único (auto-gerado) |
| Título | text | Nome/descrição da admissão + tags |
| Prioridade | enum | URGENTE, ALTA, NORMAL, BAIXA |
| Vencimento | date | Data limite |
| Responsável | uuid (FK) | Referência a `omnia_users` |
| Ticket | text | Número do ticket externo (Octa) |
| Status | uuid (FK) | Referência a `omnia_admissao_statuses` |
| Comentários | int | Contagem (calculado) |
| Anexos | int | Contagem (calculado) |

### Status do Fluxo de Admissão (em ordem)
| # | Status | Cor Sugerida | Descrição |
|---|--------|--------------|-----------|
| 1 | Imprimir | `#3b82f6` (azul) | Documentos precisam ser impressos |
| 2 | Assinatura Funcionário | `#f59e0b` (amarelo) | Aguardando assinatura do funcionário |
| 3 | Enviar malote | `#8b5cf6` (roxo) | Pronto para envio via malote |
| 4 | Aguardando retorno | `#6b7280` (cinza) | Malote enviado, aguardando volta |
| 5 | Escanear | `#06b6d4` (ciano) | Documentos retornaram, digitalizar |
| 6 | Enviar Analista | `#ec4899` (rosa) | Enviar docs digitalizados ao analista |
| 7 | Arquivar | `#f97316` (laranja) | Pronto para arquivamento físico |
| 8 | Concluído | `#10b981` (verde) | ✓ Processo finalizado |
| 9 | On-hold | `#ef4444` (vermelho) | ⏸ Pausado (paralelo a todos) |

---

## Fases de Implementação

### Fase 1: Banco de Dados (Supabase)
**Estimativa**: ~30 min

#### 1.1 Criar tabela `omnia_admissao_statuses`
```sql
CREATE TABLE omnia_admissao_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL,
  order_position integer NOT NULL,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE omnia_admissao_statuses ENABLE ROW LEVEL SECURITY;

-- Política de leitura para usuários autenticados
CREATE POLICY "Usuários autenticados podem ler status de admissão"
  ON omnia_admissao_statuses FOR SELECT
  TO authenticated
  USING (true);

-- Política de escrita para admins
CREATE POLICY "Admins podem gerenciar status de admissão"
  ON omnia_admissao_statuses FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
```

#### 1.2 Inserir status padrão
```sql
INSERT INTO omnia_admissao_statuses (name, color, order_position, is_default) VALUES
  ('Imprimir', '#3b82f6', 1, true),
  ('Assinatura Funcionário', '#f59e0b', 2, false),
  ('Enviar malote', '#8b5cf6', 3, false),
  ('Aguardando retorno', '#6b7280', 4, false),
  ('Escanear', '#06b6d4', 5, false),
  ('Enviar Analista', '#ec4899', 6, false),
  ('Arquivar', '#f97316', 7, false),
  ('Concluído', '#10b981', 8, false),
  ('On-hold', '#ef4444', 9, false);
```

#### 1.3 Criar tabela `omnia_admissoes`
```sql
CREATE TABLE omnia_admissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id serial UNIQUE,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'NORMAL' 
    CHECK (priority IN ('URGENTE', 'ALTA', 'NORMAL', 'BAIXA')),
  due_date date,
  ticket_octa text,
  status_id uuid NOT NULL REFERENCES omnia_admissao_statuses(id),
  assigned_to uuid REFERENCES omnia_users(id),
  created_by uuid REFERENCES omnia_users(id),
  tags text[] DEFAULT '{}',
  comment_count integer DEFAULT 0,
  attachment_count integer DEFAULT 0,
  is_private boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX idx_admissoes_status ON omnia_admissoes(status_id);
CREATE INDEX idx_admissoes_assigned ON omnia_admissoes(assigned_to);
CREATE INDEX idx_admissoes_due_date ON omnia_admissoes(due_date);

-- Habilitar RLS
ALTER TABLE omnia_admissoes ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (mesmo padrão de omnia_tickets)
CREATE POLICY "Usuários autenticados podem ler admissões"
  ON omnia_admissoes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem criar admissões"
  ON omnia_admissoes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar admissões"
  ON omnia_admissoes FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem deletar admissões"
  ON omnia_admissoes FOR DELETE
  TO authenticated
  USING (true);
```

#### 1.4 Criar tabela `omnia_admissao_comments`
```sql
CREATE TABLE omnia_admissao_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admissao_id uuid NOT NULL REFERENCES omnia_admissoes(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES omnia_users(id),
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_admissao_comments_admissao ON omnia_admissao_comments(admissao_id);

-- RLS
ALTER TABLE omnia_admissao_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ler comentários de admissão"
  ON omnia_admissao_comments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuários autenticados podem criar comentários de admissão"
  ON omnia_admissao_comments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem deletar seus comentários"
  ON omnia_admissao_comments FOR DELETE TO authenticated
  USING (author_id = (SELECT id FROM omnia_users WHERE auth_user_id = auth.uid()));
```

#### 1.5 Criar tabela `omnia_admissao_attachments`
```sql
CREATE TABLE omnia_admissao_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admissao_id uuid NOT NULL REFERENCES omnia_admissoes(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  size_kb integer,
  mime_type text,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_admissao_attachments_admissao ON omnia_admissao_attachments(admissao_id);

-- RLS
ALTER TABLE omnia_admissao_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ler anexos de admissão"
  ON omnia_admissao_attachments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuários autenticados podem criar anexos de admissão"
  ON omnia_admissao_attachments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem deletar anexos de admissão"
  ON omnia_admissao_attachments FOR DELETE TO authenticated USING (true);
```

#### 1.6 Triggers para contadores
```sql
-- Trigger para atualizar comment_count
CREATE OR REPLACE FUNCTION update_admissao_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE omnia_admissoes SET comment_count = comment_count + 1 WHERE id = NEW.admissao_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE omnia_admissoes SET comment_count = comment_count - 1 WHERE id = OLD.admissao_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_admissao_comment_count
AFTER INSERT OR DELETE ON omnia_admissao_comments
FOR EACH ROW EXECUTE FUNCTION update_admissao_comment_count();

-- Trigger para atualizar attachment_count
CREATE OR REPLACE FUNCTION update_admissao_attachment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE omnia_admissoes SET attachment_count = attachment_count + 1 WHERE id = NEW.admissao_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE omnia_admissoes SET attachment_count = attachment_count - 1 WHERE id = OLD.admissao_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_admissao_attachment_count
AFTER INSERT OR DELETE ON omnia_admissao_attachments
FOR EACH ROW EXECUTE FUNCTION update_admissao_attachment_count();

-- Trigger para updated_at
CREATE TRIGGER set_admissoes_updated_at
BEFORE UPDATE ON omnia_admissoes
FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);
```

#### 1.7 Criar bucket de storage (se necessário)
```sql
-- Verificar se bucket já existe, senão criar
INSERT INTO storage.buckets (id, name, public)
VALUES ('admissoes', 'admissoes', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage
CREATE POLICY "Usuários podem fazer upload em admissoes"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'admissoes');

CREATE POLICY "Usuários podem ler arquivos de admissoes"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'admissoes');

CREATE POLICY "Usuários podem deletar arquivos de admissoes"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'admissoes');
```

---

### Fase 2: Atualizar Types do Supabase
**Estimativa**: ~10 min

- [ ] Gerar novos types com `mcp3_generate_typescript_types`
- [ ] Copiar types atualizados para `src/integrations/supabase/types.ts`

---

### Fase 3: Camada de Repositório
**Estimativa**: ~45 min

#### 3.1 Criar `admissaoStatusRepo.supabase.ts`
Arquivos de referência: `tarefaStatusRepo.supabase.ts`

```
src/repositories/admissaoStatusRepo.supabase.ts
```

Interface:
```typescript
export interface AdmissaoStatus {
  id: string;
  name: string;
  color: string;
  order: number;
  isDefault?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
```

Métodos:
- `list(): Promise<AdmissaoStatus[]>`
- `create(data): Promise<AdmissaoStatus>`
- `update(id, data): Promise<AdmissaoStatus | null>`
- `remove(id): Promise<boolean>`
- `reorder(statuses): Promise<void>`

#### 3.2 Criar `admissoesRepo.supabase.ts`
Arquivos de referência: `tarefasRepo.supabase.ts`

```
src/repositories/admissoesRepo.supabase.ts
```

Interface:
```typescript
export type AdmissaoPrioridade = 'URGENTE' | 'ALTA' | 'NORMAL' | 'BAIXA';

export interface Admissao {
  id: string;
  title: string;
  description?: string;
  priority: AdmissaoPrioridade;
  dueDate?: Date;
  ticketOcta?: string;
  ticketId?: number;
  statusId: string;
  assignedTo?: UserRef;
  createdBy?: UserRef;
  tags: string[];
  commentCount: number;
  attachmentCount: number;
  createdAt: Date;
  updatedAt: Date;
  isPrivate: boolean;
}
```

Métodos:
- `list(filters?): Promise<Admissao[]>`
- `get(id): Promise<Admissao | null>`
- `create(data): Promise<Admissao>`
- `update(id, data): Promise<Admissao | null>`
- `remove(id): Promise<boolean>`
- `search(query): Promise<Admissao[]>`

#### 3.3 Criar `admissaoCommentsRepo.supabase.ts`
Arquivos de referência: `ticketCommentsRepo.supabase.ts`

#### 3.4 Criar `admissaoAttachmentsRepo.supabase.ts`
Arquivos de referência: `ticketAttachmentsRepo.supabase.ts`

---

### Fase 4: Camada de Store (Zustand)
**Estimativa**: ~30 min

#### 4.1 Criar `admissaoStatus.store.ts`
```
src/store/admissaoStatus.store.ts
```
Referência: `tarefaStatus.store.ts`

#### 4.2 Criar `admissoes.store.ts`
```
src/store/admissoes.store.ts
```
Referência: `tarefas.store.ts`

---

### Fase 5: Componentes UI
**Estimativa**: ~2h

#### 5.1 Criar componentes específicos de Admissões
```
src/components/admissoes/
├── AdmissaoStatusSelect.tsx     (baseado em TicketStatusSelect)
├── AdmissaoStatusList.tsx       (baseado em TicketStatusList)
├── AdmissaoStatusForm.tsx       (baseado em TicketStatusForm)
├── AdmissaoForm.tsx             (baseado em TicketForm)
├── AdmissaoCommentsList.tsx     (baseado em TicketCommentsList)
├── AdmissaoCommentInput.tsx     (baseado em TicketCommentInput)
├── AdmissaoAttachmentsList.tsx  (baseado em TicketAttachmentsList)
└── AdmissaoFileUploader.tsx     (baseado em TicketFileUploader)
```

---

### Fase 6: Páginas (App Router)
**Estimativa**: ~1.5h

#### 6.1 Criar páginas de Admissões
```
src/app/admissoes/
├── page.tsx           (listagem - baseado em /tarefas/page.tsx)
├── new/
│   └── page.tsx       (criar nova - baseado em /tarefas/new/page.tsx)
└── [id]/
    ├── page.tsx       (detalhes - baseado em /tarefas/[id]/page.tsx)
    └── edit/
        └── page.tsx   (editar - baseado em /tarefas/[id]/edit/page.tsx)
```

#### 6.2 Criar página de configuração de status
```
src/app/config/admissao-status/
└── page.tsx           (baseado em /config/ticket-status/page.tsx)
```

---

### Fase 7: Menu e Permissões
**Estimativa**: ~15 min

#### 7.1 Adicionar item no menu
```sql
INSERT INTO omnia_menu_items (name, path, icon, order_index, is_active)
VALUES ('Admissões', '/admissoes', 'UserPlus', 3, true);

-- Pegar o ID do novo item
-- Adicionar permissões para roles
INSERT INTO omnia_role_permissions (role_name, menu_item_id, can_access)
SELECT 'ADMIN', id, true FROM omnia_menu_items WHERE path = '/admissoes'
UNION ALL
SELECT 'SECRETARIO', id, true FROM omnia_menu_items WHERE path = '/admissoes'
UNION ALL
SELECT 'USUARIO', id, true FROM omnia_menu_items WHERE path = '/admissoes';
```

#### 7.2 Adicionar item de config no menu (submenu de Configurações)
```sql
INSERT INTO omnia_menu_items (name, path, icon, parent_id, order_index, is_active)
SELECT 'Status de Admissão', '/config/admissao-status', 'Settings', id, 3, true
FROM omnia_menu_items WHERE path = '/config';

-- Permissões para config (apenas admins)
INSERT INTO omnia_role_permissions (role_name, menu_item_id, can_access)
SELECT 'ADMIN', id, true FROM omnia_menu_items WHERE path = '/config/admissao-status';
```

---

### Fase 8: Real-time e Notificações
**Estimativa**: ~30 min

#### 8.1 Configurar listeners real-time
- Adicionar channel para `omnia_admissoes`
- Adicionar channel para `omnia_admissao_comments`
- Adicionar channel para `omnia_admissao_attachments`

#### 8.2 (Opcional) Integrar com sistema de notificações existente
- Adicionar tipo `'admissao_assigned'` ao enum de notificações
- Criar trigger para notificar quando responsável muda

---

### Fase 9: Testes e Validação
**Estimativa**: ~1h

- [ ] Testar CRUD de status de admissão
- [ ] Testar CRUD de admissões
- [ ] Testar comentários e anexos
- [ ] Testar filtros e busca
- [ ] Testar permissões de acesso
- [ ] Testar real-time updates
- [ ] Verificar responsividade mobile

---

## Resumo de Arquivos a Criar/Modificar

### Novos Arquivos (17)
```
src/repositories/
├── admissaoStatusRepo.supabase.ts
├── admissoesRepo.supabase.ts
├── admissaoCommentsRepo.supabase.ts
└── admissaoAttachmentsRepo.supabase.ts

src/store/
├── admissaoStatus.store.ts
└── admissoes.store.ts

src/components/admissoes/
├── AdmissaoStatusSelect.tsx
├── AdmissaoStatusList.tsx
├── AdmissaoStatusForm.tsx
├── AdmissaoForm.tsx
├── AdmissaoCommentsList.tsx
├── AdmissaoCommentInput.tsx
├── AdmissaoAttachmentsList.tsx
└── AdmissaoFileUploader.tsx

src/app/admissoes/
├── page.tsx
├── new/page.tsx
├── [id]/page.tsx
└── [id]/edit/page.tsx

src/app/config/admissao-status/
└── page.tsx
```

### Arquivos a Modificar (1)
```
src/integrations/supabase/types.ts  (regenerar com novos tipos)
```

---

## Estimativa Total de Tempo

| Fase | Tempo Estimado |
|------|----------------|
| Fase 1: Banco de Dados | 30 min |
| Fase 2: Types | 10 min |
| Fase 3: Repositórios | 45 min |
| Fase 4: Stores | 30 min |
| Fase 5: Componentes | 2h |
| Fase 6: Páginas | 1.5h |
| Fase 7: Menu/Permissões | 15 min |
| Fase 8: Real-time | 30 min |
| Fase 9: Testes | 1h |
| **Total** | **~7h** |

---

## Observações

1. **Reutilização**: Grande parte do código será adaptação direta do módulo de Tarefas, reduzindo risco de bugs
2. **Consistência**: Seguir exatamente os mesmos padrões de nomenclatura e estrutura
3. **Tags**: Reutilizar o sistema de tags existente (`omnia_tags`)
4. **Responsáveis**: Usar a mesma tabela `omnia_users` e store `secretarios.store.ts`
5. **On-hold**: Este status funciona em paralelo - uma admissão pode estar "On-hold" independente de em qual etapa do fluxo estava

---

## Aprovação

- [ ] **Aprovado pelo usuário para iniciar implementação**

Após aprovação, iniciarei pela **Fase 1** (Banco de Dados) usando o MCP do Supabase.
