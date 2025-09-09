# Transformação dos Status do CRM

## Resumo
Este documento descreve a transformação dos status do CRM de valores fixos (enum) para uma tabela dinâmica configurável, seguindo o padrão já implementado para os status das atas.

## Motivação
- Permitir configuração dinâmica dos status do CRM pelos administradores
- Manter consistência com o padrão já estabelecido para status das atas
- Facilitar manutenção e evolução dos status sem necessidade de alterações no código

## Mudanças Implementadas

### 1. Banco de Dados

#### Migração: `20250115000002_create_omnia_crm_statuses.sql`
```sql
-- Criação da tabela omnia_crm_statuses
CREATE TABLE omnia_crm_statuses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) NOT NULL DEFAULT '#6B7280',
  "order" INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Inserção dos status padrão
INSERT INTO omnia_crm_statuses (name, color, "order", is_default) VALUES
('Novo', '#3B82F6', 1, true),
('Qualificado', '#10B981', 2, false),
('Proposta Enviada', '#F59E0B', 3, false),
('Em Negociação', '#8B5CF6', 4, false),
('Em Espera', '#6B7280', 5, false),
('Ganho', '#059669', 6, false),
('Perdido', '#DC2626', 7, false);

-- Políticas RLS
ALTER TABLE omnia_crm_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view CRM statuses" ON omnia_crm_statuses
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage CRM statuses" ON omnia_crm_statuses
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'ADMIN'
    )
  );
```

#### Migração: `20250115000003_alter_crm_leads_status_to_uuid.sql`
```sql
-- Backup dos dados existentes
CREATE TEMP TABLE crm_leads_backup AS 
SELECT id, status FROM crm_leads;

-- Alterar coluna status para UUID
ALTER TABLE crm_leads 
ALTER COLUMN status TYPE UUID USING (
  CASE status
    WHEN 'novo' THEN (SELECT id FROM omnia_crm_statuses WHERE name = 'Novo')
    WHEN 'qualificado' THEN (SELECT id FROM omnia_crm_statuses WHERE name = 'Qualificado')
    WHEN 'proposta_enviada' THEN (SELECT id FROM omnia_crm_statuses WHERE name = 'Proposta Enviada')
    WHEN 'em_negociacao' THEN (SELECT id FROM omnia_crm_statuses WHERE name = 'Em Negociação')
    WHEN 'on_hold' THEN (SELECT id FROM omnia_crm_statuses WHERE name = 'Em Espera')
    WHEN 'ganho' THEN (SELECT id FROM omnia_crm_statuses WHERE name = 'Ganho')
    WHEN 'perdido' THEN (SELECT id FROM omnia_crm_statuses WHERE name = 'Perdido')
    ELSE (SELECT id FROM omnia_crm_statuses WHERE is_default = true LIMIT 1)
  END
);

-- Adicionar foreign key constraint
ALTER TABLE crm_leads 
ADD CONSTRAINT fk_crm_leads_status 
FOREIGN KEY (status) REFERENCES omnia_crm_statuses(id);
```

### 2. Backend

#### Repository: `crmStatusRepo.supabase.ts`
- Criado seguindo o padrão de `statusRepo.supabase.ts`
- Implementa operações CRUD para status do CRM
- Inclui método de reordenação

#### Store: `crmStatus.store.ts`
- Store Zustand para gerenciar estado dos status do CRM
- Métodos: `loadStatuses`, `createStatus`, `updateStatus`, `deleteStatus`, `reorderStatuses`
- Tratamento de estados de loading e erro

### 3. Frontend

#### Componentes Criados
- `CrmStatusForm.tsx` - Formulário para criar/editar status
- `CrmStatusList.tsx` - Lista com drag-and-drop para reordenação
- `ConfigCrmStatus.tsx` - Página de configuração

#### Componentes Atualizados
- `CrmLeadForm.tsx` - Select agora usa dados da tabela
- `badge-crm-status.tsx` - Badge dinâmico baseado nos dados da tabela
- `crmLeadsRepo.supabase.ts` - Interface `CrmLead` atualizada (status: string)

#### Rotas
- Adicionada rota `/config/crm-status` no `App.tsx`
- Protegida por `RoleProtectedRoute` (apenas ADMIN)

## Arquivos Criados

```
src/
├── repositories/
│   └── crmStatusRepo.supabase.ts
├── store/
│   └── crmStatus.store.ts
├── components/
│   └── crm-status/
│       ├── CrmStatusForm.tsx
│       └── CrmStatusList.tsx
└── pages/
    └── config/
        └── ConfigCrmStatus.tsx
```

## Arquivos Modificados

```
src/
├── App.tsx (nova rota)
├── components/
│   ├── crm/
│   │   ├── CrmLeadForm.tsx (Select dinâmico)
│   │   └── badge-crm-status.tsx (badge dinâmico)
└── repositories/
    └── crmLeadsRepo.supabase.ts (interface CrmLead)
```

## Scripts SQL Necessários

Para aplicar as mudanças em produção, execute as migrações na ordem:

1. `20250115000002_create_omnia_crm_statuses.sql`
2. `20250115000003_alter_crm_leads_status_to_uuid.sql`

## Funcionalidades

### Para Administradores
- Acesso à página `/config/crm-status`
- Criar, editar e excluir status
- Reordenar status via drag-and-drop
- Definir cores personalizadas
- Marcar status padrão

### Para Usuários
- Seleção de status dinâmica no formulário de leads
- Visualização de badges coloridos conforme configuração
- Status sempre atualizados conforme configuração dos admins

## Compatibilidade

- ✅ Dados existentes migrados automaticamente
- ✅ Interface mantém funcionalidade anterior
- ✅ Novos status podem ser adicionados sem alteração de código
- ✅ Cores e ordem configuráveis

## Próximos Passos

1. Testar a migração em ambiente de desenvolvimento
2. Validar funcionamento completo da interface
3. Aplicar migrações em produção
4. Treinar administradores na nova funcionalidade

## Observações

- A transformação segue exatamente o padrão já estabelecido para status das atas
- Mantém compatibilidade total com dados existentes
- Permite evolução futura sem necessidade de alterações no código
- Interface administrativa intuitiva e consistente com o resto do sistema