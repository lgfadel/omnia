# OMNIA - Arquitetura e Guia de Desenvolvimento

## Visão Geral

O **OMNIA** é um sistema completo de gestão desenvolvido pela **Euro Condomínios** para gerenciamento de atas de assembleias condominiais e sistema de tickets/tarefas. Este documento serve como guia arquitetural definitivo para futuras implementações e manutenções.

---

## 🏗️ Arquitetura Geral

### Stack Tecnológico Principal

#### Frontend
- **Framework**: React 18 com TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + CSS Variables (HSL)
- **UI Components**: Radix UI + shadcn/ui
- **State Management**: Zustand
- **Forms**: React Hook Form + Zod validation
- **HTTP Client**: Supabase Client
- **Notifications**: Sonner (toast)
- **Icons**: Lucide React
- **Drag & Drop**: @dnd-kit
- **Charts**: @ant-design/plots

#### Backend
- **Database**: PostgreSQL (Supabase)
- **Authentication**: Supabase Auth
- **Real-time**: Supabase Realtime
- **Storage**: Supabase Storage
- **Edge Functions**: Supabase Functions (Deno)

#### DevOps & Tooling
- **Package Manager**: npm
- **Linting**: ESLint
- **Testing**: Playwright
- **Version Control**: Git
- **Deployment**: Supabase Platform

---

## 🎨 Design System

### Paleta de Cores (HSL)

#### Cores Principais
```css
/* OMNIA Design System - Core Colors */
--background: 0 0% 98%;
--foreground: 215 28% 17%;
--primary: 214 84% 56%;        /* OMNIA Blue */
--primary-foreground: 0 0% 100%;
--secondary: 210 40% 96%;
--destructive: 0 84% 60%;
--warning: 43 96% 56%;         /* OMNIA Yellow */
--success: 142 71% 45%;        /* OMNIA Green */
```

#### Cores de Status
```css
/* Status Colors */
--status-not-started: 43 96% 56%;      /* Amarelo */
--status-in-progress: 214 84% 56%;     /* Azul OMNIA */
--status-completed: 142 71% 45%;       /* Verde */
```

### Tipografia
- **Font Family**: Sistema padrão (sans-serif)
- **Font Sizes**: Escala Tailwind (text-xs a text-4xl)
- **Font Weights**: 400 (normal), 500 (medium), 600 (semibold), 700 (bold)

### Espaçamento
- **Padding/Margin**: Escala Tailwind (0.25rem a 6rem)
- **Border Radius**: 
  - `--radius: 0.375rem` (base)
  - `lg: var(--radius)`
  - `md: calc(var(--radius) - 2px)`
  - `sm: calc(var(--radius) - 4px)`

### Componentes UI Padronizados

#### Botões
- **Primary**: Azul OMNIA com texto branco
- **Secondary**: Cinza claro com texto escuro
- **Destructive**: Vermelho para ações de exclusão
- **Ghost**: Transparente com hover
- **Outline**: Borda com fundo transparente

#### Badges de Status
```typescript
const statusConfig = {
  "nao-iniciado": {
    className: "bg-status-not-started text-status-not-started-foreground",
    label: "Não Iniciado"
  },
  "em-andamento": {
    className: "bg-status-in-progress text-status-in-progress-foreground",
    label: "Em Andamento"
  },
  "concluido": {
    className: "bg-status-completed text-status-completed-foreground",
    label: "Concluído"
  }
}
```

#### Tabela OMNIA (`TabelaOmnia`)
- Componente padronizado para listagens
- Suporte a ordenação, filtros e agrupamento
- Ações inline (visualizar, editar, excluir)
- Responsiva com scroll horizontal
- Suporte a drag & drop para reordenação

---

## 🗄️ Arquitetura de Banco de Dados

### Tabelas Principais

#### `omnia_users`
```sql
CREATE TABLE omnia_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  roles TEXT[] DEFAULT '{USUARIO}',
  avatar_url TEXT,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### `omnia_atas`
```sql
CREATE TABLE omnia_atas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,  -- A-0001, A-0002, etc.
  title TEXT NOT NULL,
  description TEXT,
  assembly_date DATE,
  secretary_id UUID REFERENCES omnia_users(id),
  responsible_id UUID REFERENCES omnia_users(id),
  status_id UUID REFERENCES omnia_statuses(id),
  tags TEXT[],
  ticket TEXT,
  comment_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES omnia_users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### `omnia_tickets`
```sql
CREATE TABLE omnia_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  priority ticket_priority DEFAULT 'NORMAL',
  due_date DATE,
  ticket TEXT,
  status_id UUID REFERENCES omnia_ticket_statuses(id),
  assigned_to UUID REFERENCES omnia_users(id),
  created_by UUID REFERENCES omnia_users(id),
  tags TEXT[],
  comment_count INTEGER DEFAULT 0,
  is_private BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### `omnia_comments`
```sql
CREATE TABLE omnia_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ata_id UUID REFERENCES omnia_atas(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `omnia_ticket_comments`
```sql
CREATE TABLE omnia_ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES omnia_tickets(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `omnia_attachments`
```sql
CREATE TABLE omnia_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ata_id UUID REFERENCES omnia_atas(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES omnia_comments(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  created_by UUID REFERENCES omnia_users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `omnia_statuses`
```sql
CREATE TABLE omnia_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  order_position INTEGER NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### `omnia_tags`
```sql
CREATE TABLE omnia_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### `omnia_condominiums`
```sql
CREATE TABLE omnia_condominiums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cnpj TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  whatsapp TEXT,
  syndic_name TEXT,
  manager_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES omnia_users(id)
);
```

### Triggers e Funções

#### Atualização de `comment_count`
```sql
-- Trigger para atualizar comment_count automaticamente
CREATE OR REPLACE FUNCTION update_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE omnia_atas 
    SET comment_count = comment_count + 1 
    WHERE id = NEW.ata_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE omnia_atas 
    SET comment_count = comment_count - 1 
    WHERE id = OLD.ata_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
```

#### Geração Automática de Códigos
```sql
-- Função para gerar códigos sequenciais para atas
CREATE OR REPLACE FUNCTION generate_ata_code()
RETURNS TRIGGER AS $$
DECLARE
  next_number INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM 3) AS INTEGER)), 0) + 1
  INTO next_number
  FROM omnia_atas
  WHERE code ~ '^A-[0-9]+$';
  
  NEW.code := 'A-' || LPAD(next_number::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Row Level Security (RLS)

#### Políticas de Segurança
```sql
-- Atas: Todos podem visualizar, apenas ADMIN/SECRETARIO podem modificar
CREATE POLICY "Users can view all atas" ON omnia_atas
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins and secretarios can create atas" ON omnia_atas
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT auth_user_id FROM omnia_users 
      WHERE 'ADMIN' = ANY(roles) OR 'SECRETARIO' = ANY(roles)
    )
  );

-- Tickets privados: apenas criador e responsável podem visualizar
CREATE POLICY "Private tickets access" ON omnia_tickets
  FOR SELECT USING (
    NOT is_private OR 
    created_by = auth.uid() OR 
    assigned_to = (
      SELECT id FROM omnia_users WHERE auth_user_id = auth.uid()
    )
  );
```

---

## 🏗️ Arquitetura de Componentes

### Estrutura de Pastas
```
src/
├── components/
│   ├── atas/              # Componentes específicos de atas
│   ├── tickets/           # Componentes específicos de tickets
│   ├── auth/              # Componentes de autenticação
│   ├── layout/            # Layout e navegação
│   ├── dashboard/         # Dashboard e métricas
│   └── ui/                # Componentes UI reutilizáveis
├── pages/                 # Páginas da aplicação
├── hooks/                 # Custom hooks
├── store/                 # Stores Zustand
├── repositories/          # Camada de acesso a dados
├── integrations/          # Integrações externas (Supabase)
├── lib/                   # Utilitários e helpers
└── utils/                 # Funções utilitárias
```

### Padrão Repository

#### Interface Base
```typescript
interface BaseRepository<T> {
  list(search?: string, filters?: any): Promise<T[]>
  getById(id: string): Promise<T | null>
  create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>
  update(id: string, data: Partial<T>): Promise<T | null>
  delete(id: string): Promise<boolean>
}
```

#### Implementação Supabase
```typescript
// Exemplo: atasRepo.supabase.ts
export const atasRepoSupabase = {
  async list(search?: string, statusFilter?: string[]) {
    let query = supabase
      .from('omnia_atas')
      .select(`
        *,
        status:omnia_statuses(*),
        secretary:omnia_users!secretary_id(*),
        responsible:omnia_users!responsible_id(*),
        created_by_user:omnia_users!created_by(*)
      `)
      .order('created_at', { ascending: false })
    
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
    }
    
    if (statusFilter?.length) {
      query = query.in('status_id', statusFilter)
    }
    
    const { data, error } = await query
    if (error) throw error
    return data || []
  },
  // ... outros métodos
}
```

### Gerenciamento de Estado (Zustand)

#### Store Pattern
```typescript
interface AtasStore {
  // Estado
  atas: Ata[]
  statuses: Status[]
  loading: boolean
  error: string | null
  
  // Ações
  loadAtas: (search?: string, statusFilter?: string[]) => Promise<void>
  createAta: (data: CreateAtaData) => Promise<Ata>
  updateAta: (id: string, data: UpdateAtaData) => Promise<Ata | null>
  deleteAta: (id: string) => Promise<boolean>
  clearError: () => void
}

export const useAtasStore = create<AtasStore>((set, get) => ({
  // Implementação...
}))
```

### Componentes UI Compartilhados

#### TabelaOmnia
- Tabela padronizada para listagens
- Suporte a ordenação, filtros e paginação
- Ações inline configuráveis
- Agrupamento por status
- Responsiva com scroll horizontal

#### FormOmnia
- Formulários padronizados com React Hook Form
- Validação com Zod
- Campos reutilizáveis (input, select, textarea, etc.)
- Feedback de erro consistente

#### ModalOmnia
- Modais padronizados com Radix Dialog
- Tamanhos configuráveis
- Animações suaves
- Acessibilidade (ARIA)

#### BadgeStatus
- Badges de status com cores padronizadas
- Suporte a status customizados
- Fallback para status não encontrados

---

## 🔐 Sistema de Autenticação e Autorização

### Roles do Sistema
```typescript
type UserRole = 'ADMIN' | 'SECRETARIO' | 'USUARIO'

interface User {
  id: string
  authUserId: string
  name: string
  email: string
  roles: UserRole[]
  avatarUrl?: string
  color?: string
}
```

### Permissões por Role

#### ADMIN
- Acesso total ao sistema
- Gerenciar usuários, status, tags
- Criar, editar, excluir atas e tickets
- Visualizar todos os dados
- Configurações do sistema

#### SECRETARIO
- Criar e editar atas
- Gerenciar comentários e anexos
- Visualizar todos os tickets
- Criar tickets públicos
- Editar tickets atribuídos

#### USUARIO
- Visualizar atas públicas
- Comentar em atas (se permitido)
- Criar tickets privados
- Visualizar apenas tickets próprios ou atribuídos
- Editar tickets próprios

### Context de Autenticação
```typescript
interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  hasRole: (role: UserRole) => boolean
  hasAnyRole: (roles: UserRole[]) => boolean
}
```

---

## 🚀 Configuração de Desenvolvimento

### Variáveis de Ambiente
```env
VITE_SUPABASE_URL=https://elmxwvimjxcswjbrzznq.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Scripts NPM
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "build:dev": "vite build --mode development",
    "lint": "eslint .",
    "preview": "vite preview"
  }
}
```

### Configuração do Vite
```typescript
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,  // PORTA PADRÃO OMNIA
  },
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}))
```

---

## 📋 Padrões de Desenvolvimento

### Convenções de Nomenclatura

#### Arquivos e Pastas
- **Componentes**: PascalCase (`AtaForm.tsx`)
- **Hooks**: camelCase com prefixo `use` (`useAtasStore.ts`)
- **Utilitários**: camelCase (`userColors.ts`)
- **Páginas**: PascalCase (`AtaDetail.tsx`)
- **Stores**: camelCase com sufixo `.store` (`atas.store.ts`)

#### Variáveis e Funções
- **Variáveis**: camelCase (`userName`, `isLoading`)
- **Funções**: camelCase (`handleSubmit`, `loadData`)
- **Constantes**: UPPER_SNAKE_CASE (`API_BASE_URL`)
- **Interfaces**: PascalCase (`UserInterface`, `AtaData`)

### Estrutura de Componentes
```typescript
// Imports
import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

// Types
interface ComponentProps {
  // props definition
}

// Schema validation
const schema = z.object({
  // validation rules
})

// Component
export function Component({ prop1, prop2 }: ComponentProps) {
  // Hooks
  const form = useForm({
    resolver: zodResolver(schema)
  })
  
  // Handlers
  const handleSubmit = async (data: FormData) => {
    // implementation
  }
  
  // Render
  return (
    <div>
      {/* JSX */}
    </div>
  )
}
```

### Validação com Zod
```typescript
// Schema para criação de ata
export const createAtaSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório'),
  description: z.string().optional(),
  assemblyDate: z.date().optional(),
  secretaryId: z.string().uuid().optional(),
  responsibleId: z.string().uuid().optional(),
  statusId: z.string().uuid(),
  tags: z.array(z.string()).default([]),
  ticket: z.string().optional()
})

type CreateAtaData = z.infer<typeof createAtaSchema>
```

### Error Handling
```typescript
// Padrão para tratamento de erros
try {
  const result = await apiCall()
  toast.success('Operação realizada com sucesso!')
  return result
} catch (error) {
  console.error('Error:', error)
  toast.error('Erro ao realizar operação')
  throw error
}
```

---

## 🔧 Utilitários e Helpers

### Cores de Usuário
```typescript
// lib/userColors.ts
export const generateUserColor = (userId: string): string => {
  const colors = [
    'hsl(0, 70%, 60%)',   // Vermelho
    'hsl(120, 70%, 60%)', // Verde
    'hsl(240, 70%, 60%)', // Azul
    // ... mais cores
  ]
  
  const hash = userId.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0)
    return a & a
  }, 0)
  
  return colors[Math.abs(hash) % colors.length]
}

export const getUserInitials = (name: string): string => {
  return name
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2)
}
```

### Utilitários de Data
```typescript
// utils/dateUtils.ts
export const formatDate = (date: Date | string): string => {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(date))
}

export const formatDateTime = (date: Date | string): string => {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(date))
}
```

---

## 🧪 Testing

### Playwright Configuration
```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'on-first-retry',
  },
})
```

### Testes E2E
```typescript
// tests/atas.spec.ts
import { test, expect } from '@playwright/test'

test('should create new ata', async ({ page }) => {
  await page.goto('/atas/new')
  await page.fill('[data-testid="title-input"]', 'Nova Ata')
  await page.click('[data-testid="submit-button"]')
  await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
})
```

---

## 🚀 Deployment

### Build de Produção
```bash
# Build para produção
npm run build

# Preview do build
npm run preview
```

### Configuração Supabase
```toml
# supabase/config.toml
[api]
enabled = true
port = 54321
schemas = ["public", "storage", "graphql_public"]

[db]
port = 54322
shadow_port = 54320
major_version = 15

[studio]
enabled = true
port = 54323
```

---

## 📚 Recursos e Documentação

### Links Úteis
- **Supabase Docs**: https://supabase.com/docs
- **Radix UI**: https://www.radix-ui.com/
- **Tailwind CSS**: https://tailwindcss.com/
- **React Hook Form**: https://react-hook-form.com/
- **Zod**: https://zod.dev/
- **Zustand**: https://zustand-demo.pmnd.rs/

### Comandos Úteis
```bash
# Desenvolvimento
npm run dev

# Build
npm run build

# Lint
npm run lint

# Supabase
supabase start
supabase db reset
supabase db push
```

---

## 🔄 Versionamento e Changelog

### Convenção de Commits
- `feat:` Nova funcionalidade
- `fix:` Correção de bug
- `docs:` Documentação
- `style:` Formatação, estilos
- `refactor:` Refatoração de código
- `test:` Testes
- `chore:` Tarefas de manutenção

### Exemplo de Commit
```bash
git commit -m "feat: adiciona sistema de comentários em tickets

- Implementa componente TicketCommentInput
- Adiciona repository para ticket comments
- Integra com sistema de notificações
- Adiciona testes E2E para comentários"
```

---

## 🤝 Contribuição

### Fluxo de Desenvolvimento
1. **Fork** do repositório
2. **Branch** para feature (`git checkout -b feature/nova-funcionalidade`)
3. **Commit** das mudanças (`git commit -m 'feat: adiciona nova funcionalidade'`)
4. **Push** para branch (`git push origin feature/nova-funcionalidade`)
5. **Pull Request** para review

### Code Review
- Verificar conformidade com padrões de código
- Testar funcionalidade localmente
- Verificar impacto em performance
- Validar acessibilidade
- Confirmar testes passando

---

## 📝 Notas Importantes

### Porta Padrão
- **Desenvolvimento**: Sempre usar porta **8080**
- **Preview**: Manter consistência com porta 8080

### Tecnologias Homologadas
- **Frontend**: React + TypeScript + Tailwind
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **State**: Zustand (não Redux)
- **Forms**: React Hook Form + Zod
- **UI**: Radix UI + shadcn/ui
- **Icons**: Lucide React

### Arquitetura Obrigatória
- **Repository Pattern** para acesso a dados
- **Zustand Stores** para gerenciamento de estado
- **Component Composition** para reutilização
- **TypeScript** em todos os arquivos
- **Zod Validation** em formulários
- **RLS Policies** para segurança

---

**Última atualização**: Janeiro 2025  
**Versão**: 1.0  
**Responsável**: Agente OMNIA - Euro Condomínios

---

> Este documento deve ser consultado antes de qualquer implementação ou modificação no sistema OMNIA. Mantenha-o atualizado conforme a evolução da arquitetura.