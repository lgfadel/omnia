# Omnia - Sistema de Gestão de Atas

Sistema moderno para gestão de atas de reunião com interface intuitiva e funcionalidades avançadas. O Omnia é uma aplicação web completa que oferece controle granular de permissões, gestão de anexos, sistema de comentários em tempo real e interface responsiva.

**Project URL**: https://lovable.dev/projects/4c2091c0-2d80-4db8-8375-50b304a9ba25

## 📋 Índice

- [🏗️ Arquitetura Geral](#️-arquitetura-geral)
- [🚀 Stack Tecnológico](#-stack-tecnológico)
- [📁 Arquitetura do Projeto](#-arquitetura-do-projeto)
- [🔧 Setup and Development](#setup-and-development)
- [✨ Funcionalidades Principais](#-funcionalidades-principais)
- [🗄️ Esquema do Banco de Dados](#️-esquema-do-banco-de-dados)
- [🏗️ Arquitetura de Componentes](#️-arquitetura-de-componentes)
- [📈 Melhorias Recentes](#-melhorias-recentes)
- [📋 Padrões de Desenvolvimento](#-padrões-de-desenvolvimento)
- [🔒 Segurança e Permissões](#-segurança-e-permissões)
- [⚡ Performance e Otimização](#-performance-e-otimização)
- [🧪 Testing e Quality Assurance](#-testing-e-quality-assurance)
- [🚀 Deployment e DevOps](#-deployment-e-devops)
- [🤝 Contributing](#-contributing)
- [📚 Recursos Adicionais](#-recursos-adicionais)

## 🏗️ Arquitetura Geral

### Visão Geral da Arquitetura
O Omnia segue uma arquitetura moderna de aplicação web com separação clara de responsabilidades:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Supabase      │    │   Storage       │
│   (React/TS)    │◄──►│   (PostgreSQL)   │◄──►│   (Files)       │
│                 │    │                  │    │                 │
│ • Components    │    │ • Database       │    │ • Attachments   │
│ • Stores        │    │ • Auth           │    │ • Images        │
│ • Repositories  │    │ • Real-time      │    │ • Documents     │
│ • Pages         │    │ • RLS Policies   │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Padrões Arquiteturais

#### 1. **Repository Pattern**
- Abstração da camada de dados com interfaces bem definidas
- Implementação específica para Supabase em `src/repositories/`
- Facilita testes e mudanças de backend

#### 2. **Store Pattern (Zustand)**
- Gerenciamento de estado reativo e performático
- Stores especializados por domínio (`atas.store.ts`, `status.store.ts`)
- Estado global acessível em toda a aplicação

#### 3. **Component Composition**
- Componentes reutilizáveis baseados em shadcn/ui
- Separação entre componentes de UI e de negócio
- Props drilling minimizado com context e stores

#### 4. **Custom Hooks Pattern**
- Lógica reutilizável encapsulada (`use-mobile`, `use-toast`)
- Separação de concerns entre UI e lógica de negócio

#### 5. **Query Pattern**
- Cache e sincronização de dados otimizada
- Invalidação automática de cache
- Loading states e error handling centralizados

## 🚀 Stack Tecnológico

### Frontend Core
- **React 18** - Framework frontend com Concurrent Features
- **TypeScript 5.x** - Tipagem estática avançada com strict mode
- **Vite 5.x** - Build tool com HMR otimizado
- **Tailwind CSS 3.x** - Framework CSS utility-first com JIT

### Backend & Database
- **Supabase** - Backend-as-a-Service completo
  - PostgreSQL 15+ com extensões avançadas
  - Row Level Security (RLS) para controle granular
  - Real-time subscriptions via WebSockets
  - Authentication JWT com múltiplos providers
  - Storage para arquivos com CDN global

### State Management & Data
- **Zustand 4.x** - State management com immer integration
- **React Hook Form 7.x** - Formulários performáticos com validação
- **Zod 3.x** - Schema validation TypeScript-first
- **TanStack Query** - Server state management e cache

### UI & Design System
- **shadcn/ui** - Componentes baseados em Radix UI
- **Radix UI** - Primitivos acessíveis e unstyled
- **Lucide React** - Ícones SVG otimizados
- **next-themes** - Sistema de temas dark/light
- **Sonner** - Toast notifications elegantes

### Development & Build
- **ESLint** - Linting com regras customizadas
- **Prettier** - Code formatting automático
- **PostCSS** - Processamento CSS avançado
- **Autoprefixer** - Vendor prefixes automáticos

### Tecnologias Complementares
- **Routing**: React Router DOM
- **Drag & Drop**: @dnd-kit
- **Styling**: CVA (Class Variance Authority)
- **Color Management**: Sistema de cores HSL customizado + Seletor de cores avançado
- **File Handling**: Upload/Download de arquivos com preview e validação

## 📁 Arquitetura do Projeto

### Organização de Diretórios

```
src/
├── components/          # Componentes reutilizáveis
│   ├── ui/             # Componentes base (shadcn/ui)
│   │   ├── button.tsx  # Botões com variantes
│   │   ├── input.tsx   # Inputs com validação
│   │   ├── select.tsx  # Selects customizados
│   │   └── ...         # Outros primitivos UI
│   ├── atas/           # Componentes específicos de atas
│   │   ├── AtaForm.tsx # Formulário de criação/edição
│   │   ├── AtaDetail.tsx # Visualização detalhada
│   │   ├── CommentsList.tsx # Lista de comentários
│   │   └── AttachmentsList.tsx # Gestão de anexos
│   ├── auth/           # Componentes de autenticação
│   ├── layout/         # Componentes de layout (TopBar, Sidebar)
│   ├── secretarios/    # Componentes de gestão de usuários
│   ├── status/         # Componentes de gestão de status
│   └── tags/           # Componentes de gestão de tags
├── contexts/           # Contextos React
├── data/              # Dados estáticos e fixtures
│   └── fixtures.ts    # Dados de teste
├── hooks/             # Hooks customizados
│   ├── use-mobile.ts  # Hook para detecção mobile
│   ├── use-toast.ts   # Hook para notificações
│   └── use-auth.ts    # Hook de autenticação
├── integrations/      # Integrações com serviços externos
│   └── supabase/      # Cliente e tipos do Supabase
├── lib/               # Funções utilitárias
│   ├── supabase.ts    # Cliente Supabase
│   ├── utils.ts       # Funções utilitárias
│   └── validations.ts # Schemas Zod
├── pages/             # Componentes de página (React Router)
│   ├── Atas.tsx       # Lista principal de atas
│   ├── AtaDetail.tsx  # Detalhes de uma ata
│   ├── Login.tsx      # Autenticação
│   └── config/        # Páginas de configuração
├── repositories/      # Camada de acesso a dados (Repository Pattern)
│   ├── atasRepo.supabase.ts # Operações de atas
│   ├── authRepo.supabase.ts # Operações de auth
│   └── baseRepo.ts    # Repositório base
├── store/             # Stores do Zustand por domínio
│   ├── atas.store.ts  # Estado das atas
│   ├── auth.store.ts  # Estado de autenticação
│   ├── status.store.ts # Estado dos status
│   └── tags.store.ts  # Estado das tags
├── types/              # Definições de tipos TypeScript
│   ├── database.ts    # Tipos do Supabase
│   ├── ata.ts         # Tipos de atas
│   └── user.ts        # Tipos de usuário
└── main.tsx           # Ponto de entrada da aplicação

supabase/
├── migrations/         # Migrações versionadas do banco
│   ├── 20250815014608_*.sql # Criação inicial das tabelas
│   ├── 20250819180741_*.sql # Políticas RLS
│   └── 20250819215021_*.sql # Separação de comentários/anexos
├── functions/          # Edge functions serverless
│   └── delete-user/    # Função de exclusão de usuário
└── config.toml         # Configuração do projeto Supabase
```

### Convenções de Nomenclatura

#### Arquivos e Diretórios
- **Componentes**: PascalCase (`AtaForm.tsx`, `CommentsList.tsx`)
- **Hooks**: camelCase com prefixo `use-` (`use-mobile.ts`)
- **Stores**: camelCase com sufixo `.store.ts` (`atas.store.ts`)
- **Repositories**: camelCase com sufixo `.repo.ts` ou `.supabase.ts`
- **Types**: camelCase (`database.ts`, `ata.ts`)
- **Utilitários**: camelCase (`utils.ts`, `validations.ts`)

#### Código TypeScript
- **Interfaces**: PascalCase com prefixo `I` opcional (`Ata`, `IUser`)
- **Types**: PascalCase (`AtaFormData`, `UserRole`)
- **Enums**: PascalCase (`Status`, `Priority`)
- **Constantes**: UPPER_SNAKE_CASE (`DEFAULT_STATUS`, `MAX_FILE_SIZE`)
- **Funções**: camelCase (`createAta`, `validateForm`)
- **Variáveis**: camelCase (`currentUser`, `isLoading`)

## Setup and Development

### Prerequisites
- Node.js (recommended: use nvm)
- npm or yarn

### Installation

```sh
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to project directory
cd omnia

# Install dependencies
npm install

# Start development server
npm run dev
```

The development server runs on `http://localhost:8080/` (configured in vite.config.ts)

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Funcionalidades Principais

### 🔐 Autenticação e Autorização
- Login/logout com Supabase Auth
- Sistema de recuperação de senha
- Controle de acesso baseado em roles múltiplos (Admin, Secretário, Usuário)
- Proteção de rotas com RLS (Row Level Security)
- Menu de usuário integrado na sidebar

### 📝 Gestão de Atas
- **Criação**: Interface intuitiva para criar novas atas com código automático (A-XXXX)
- **Edição**: Edição completa de atas existentes
- **Visualização**: Interface de leitura otimizada com layout responsivo
- **Status**: Sistema de workflow com status customizáveis e cores
- **Tags**: Sistema de categorização flexível
- **Busca**: Busca avançada por título, código ou conteúdo
- **Filtros**: Filtros por status com dropdown melhorado
- **Secretários**: Atribuição de secretários responsáveis

### 💬 Sistema de Comentários
- Comentários com rich text
- Anexos em comentários com preview
- Sistema de notificações
- Histórico completo de interações
- Controle de permissões por role

### 📎 Gestão de Anexos
- Upload de arquivos via drag & drop
- Preview de imagens e documentos
- Download seguro de arquivos
- Controle de tamanho e tipo de arquivo
- Armazenamento no Supabase Storage

### 👥 Gestão de Usuários
- CRUD completo de usuários
- Sistema de roles múltiplos (array de roles)
- Perfis de usuário com avatar
- Controle de permissões granular via RLS
- Criação automática de perfil para novos usuários

### 🎨 Interface e UX
- Design system baseado em shadcn/ui + Radix UI
- Tema escuro/claro com next-themes
- Interface totalmente responsiva
- Componentes acessíveis (ARIA)
- Feedback visual consistente com Sonner (toasts)
- Drag & drop para reordenação
- Carousels e componentes interativos
- Layout com painéis redimensionáveis
- **Sistema de Cores Avançado**: Seletor de cores com 30 opções predefinidas
  - Preview em tempo real da cor selecionada
  - Input customizado para cores hexadecimais
  - Validação automática de formato de cor
  - Paleta expandida com variações modernas (Teal, Rose, Violet, etc.)
- **Melhorias de Usabilidade**: Interface otimizada para produtividade
  - Botões de ação com confirmação para operações críticas
  - Indicadores visuais para elementos com anexos
  - Feedback imediato em operações de CRUD

### Key Pages
- `/` - Dashboard with overview and quick actions
- `/atas` - Main atas listing with table/kanban views
- `/atas/new` - Create new meeting minutes
- `/atas/:id` - View ata details
- `/atas/:id/edit` - Edit existing ata
- `/config/status` - Status management
- `/config/tags` - Tag management
- `/config/usuarios` - User management

## 🗄️ Esquema do Banco de Dados

### Tabelas Principais

- **omnia_users**: Usuários do sistema com roles múltiplos
- **omnia_atas**: Atas de reunião com códigos automáticos
- **omnia_comments**: Comentários das atas
- **omnia_attachments**: Anexos com metadados
- **omnia_statuses**: Status customizáveis com cores e ordem
- **omnia_tags**: Tags para categorização

### Relacionamentos e Funcionalidades
- Atas → Usuários (secretário responsável)
- Atas → Status (workflow customizável)
- Comentários → Atas (threading)
- Comentários → Usuários (autoria)
- Anexos → Atas/Comentários (contexto flexível)
- Tags → Atas (array de tags)
- RLS (Row Level Security) para controle de acesso
- Triggers automáticos para criação de usuários
- Funções SQL para verificação de roles

### Migrações Recentes
- Migração de role singular para roles array
- Remoção da coluna obsoleta 'role'
- Atualização de políticas RLS
- Renomeação de LEITOR para USUARIO
- Implementação de funções de segurança

## 🏗️ Arquitetura de Componentes

### Padrões Utilizados
- **Repository Pattern**: Abstração da camada de dados com Supabase
- **Store Pattern**: Gerenciamento de estado reativo com Zustand
- **Component Composition**: Componentes reutilizáveis baseados em shadcn/ui
- **Custom Hooks**: Lógica reutilizável (use-mobile, use-toast)
- **Context API**: Autenticação e estado global
- **Query Pattern**: Cache e sincronização com TanStack Query

### Estrutura de Dados
- **Type Safety**: TypeScript strict em todo o projeto
- **Schema Validation**: Validação robusta com Zod
- **Auto-generated Types**: Tipos gerados automaticamente do Supabase
- **Database Types**: Tipagem completa das tabelas e funções SQL
- **Form Validation**: Integração React Hook Form + Zod

### UI Components (`src/components/ui/`)
- **TabelaOmnia**: Generic data table with sorting, filtering, and pagination
- **Select, DropdownMenu**: Form controls with Radix UI
- **Button, Input, Badge**: Basic UI primitives
- **Command, Popover**: Advanced interaction components

### Feature Components
- **StatusSelect**: Custom status selection with visual indicators
- **TagForm**: Tag creation and editing
- **MockUploader**: File upload interface
- **TopBar, Sidebar**: Layout and navigation

### State Management
- **atas.store.ts**: Atas data and operations
- **status.store.ts**: Status management
- **secretarios.store.ts**: Secretary data
- **tags.store.ts**: Tag management

## 📈 Melhorias Recentes

### Últimas Atualizações (Janeiro 2025)
- **Refatoração da Tabela Principal**: Reordenação de colunas e melhorias no estilo de badges
  - Troca de posições entre colunas "Responsável" e "Secretário" para melhor fluxo de dados
  - Conversão da exibição de secretários de avatares para badges coloridos
  - Padronização de todos os badges com cantos arredondados (rounded-md)
  - Equalização de alturas entre elementos badge e avatar
- **Funcionalidades de Tabela Avançadas**: Implementação de visualização agrupada e controles de status
  - Adição de seções colapsáveis para organização de dados
  - Funcionalidade de alteração de status inline com dropdown
  - Controles de ordenação fixos por status e data de assembleia
- **Upload via Clipboard**: Nova funcionalidade para anexar imagens diretamente nos comentários
  - Funcionalidade de colar imagens usando Ctrl+V nos comentários
  - Detecção automática de imagens no clipboard
  - Nomenclatura inteligente para imagens coladas (clipboard-image-TIMESTAMP.png)
  - Indicadores visuais específicos para identificar imagens do clipboard
  - Toast notifications com feedback durante o processo de upload
- **Correções de Segurança**: Resolução de políticas RLS para acesso universal
  - Correção das políticas de segurança para permitir acesso a todos os usuários autenticados
  - Melhorias na estrutura de permissões para diferentes roles
- **Melhorias de Layout**: Correções de alinhamento e visual
  - Remoção de bordas desnecessárias na sidebar
  - Correções de alinhamento na TopBar
  - Melhorias gerais na consistência visual

### Autenticação e Usuários
- Implementação de recuperação de senha
- Migração para sistema de roles múltiplos
- Correção de bugs na criação de usuários
- Melhoria no layout da página de autenticação
- Menu de usuário movido para sidebar

### Interface e UX
- Melhoria no sistema de filtros com dropdown
- Aprimoramento do layout de tabelas
- Correções no preview/download de anexos
- Melhorias na responsividade
- Atualização do logo e identidade visual
- **Padronização Visual**: Implementação de design system consistente
  - Badges retangulares com cantos arredondados (rounded-md) em toda aplicação
  - Equalização de alturas entre diferentes elementos de interface
  - Consistência de cores e espaçamentos seguindo padrões do Tailwind CSS
- **Melhorias na Sidebar**: Correções de alinhamento e bordas
  - Remoção de bordas desnecessárias para visual mais limpo
  - Melhor integração com o layout geral da aplicação

### Funcionalidades
- **Sistema de Status**: Correção crítica na exibição de status das atas
  - Correção do mapeamento entre dados mockados e banco de dados real
  - Sincronização correta entre status ID, nome e cores
  - Exibição dinâmica de status baseada nos dados do Supabase
  - **Expansão de Cores**: Ampliação significativa das opções de cores para status
    - Expandido de 10 para 30 cores predefinidas no formulário de cadastro
    - Novas variações incluindo Teal, Rose, Violet, Sky, Emerald, Amber e Purple
    - Correção na captura de cores selecionadas no formulário
    - Manutenção de funcionalidades existentes (preview em tempo real, input customizado)
- **Melhorias na Tabela de Atas**: Aprimoramentos significativos na interface principal
  - Reordenação de colunas para melhor agrupamento lógico
  - Conversão da coluna "Secretário" de avatar para badge colorido
  - Padronização visual com badges retangulares (rounded-md)
  - Equalização de alturas entre elementos badge e avatar
  - Funcionalidade de alteração de status inline com dropdown
  - Visualização agrupada com seções colapsáveis
  - Controles de ordenação fixos por status e data
- **Sistema de Comentários**: Melhorias na visualização de anexos
  - Indicador visual (ícone de clipe) para comentários com anexos
  - Contador de anexos ao lado do nome do autor
  - Melhoria na query para buscar anexos corretamente
  - **Funcionalidade de Exclusão**: Implementação de exclusão de comentários e anexos
    - Botões de exclusão com confirmação para comentários
    - Exclusão automática de anexos associados aos comentários
    - Interface intuitiva com ícones de lixeira
- Correções no salvamento de anexos em comentários
- Melhorias na lógica de salvamento de secretários
- Correções na abertura de atas
- Otimização de queries do banco de dados
- Implementação de migrações SQL automáticas

### Arquitetura
- Migração completa para sistema de roles array
- Remoção de código obsoleto (coluna role)
- Atualização de políticas RLS
- Melhorias na tipagem TypeScript
- Otimização da estrutura de componentes
- **Correções de Integração**: Sincronização completa entre frontend e backend
  - Mapeamento correto de IDs entre dados mockados e Supabase
  - Queries otimizadas para busca de relacionamentos (comentários → anexos)
  - Validação de dados em tempo real
- **Melhorias em Formulários**: Correções críticas na captura de dados
  - Resolução de conflitos entre `register()` e `onChange` em inputs de cor
  - Implementação de campos ocultos para garantir submissão correta de dados
  - Otimização do React Hook Form com Zod para validação robusta
- **Configuração de Desenvolvimento**: Padronização do ambiente
  - Servidor de desenvolvimento configurado na porta 8080 (vite.config.ts)
  - Hot Module Replacement (HMR) otimizado para desenvolvimento ágil
  - Configuração de host universal (::) para acesso em diferentes dispositivos
- **Correções de Segurança e Permissões**: Aprimoramentos nas políticas RLS
  - Correção das políticas RLS para `omnia_atas` permitindo acesso a todos os usuários autenticados
  - Resolução de problemas de permissão para usuários não-admin
  - Implementação de políticas mais granulares para diferentes roles (ADMIN, SECRETARIO, USUARIO)
  - Melhorias na estrutura de autenticação e autorização

### Table Enhancements
- **Column Removal**: Removed "Data Criação" column from atas table for cleaner layout
- **Column Reordering**: Reorganized columns for better logical grouping and user experience:
  - Swapped positions of "Responsável" and "Secretário" columns
  - Improved visual hierarchy and data flow
- **Column Width Optimization**: Adjusted column widths for better text fitting:
  - Título: 40% width
  - Data Assembleia: 36% width
  - Secretário: 36% width
  - Status: 28% width
  - Comentários: 16% width
- **Badge Styling Improvements**: Enhanced visual consistency across table elements:
  - Secretary column now displays as colored badges instead of avatars
  - Status badges updated with rounded corners (rounded-md) for modern appearance
  - Consistent height alignment between badge and avatar elements
  - Improved visual uniformity across all badge components

### Filter Improvements
- **Multi-Select Status Filter**: Converted badge-based status filter to dropdown with checkboxes
  - Shows "Todos os status" when no filters selected
  - Shows single status name when one selected
  - Shows "X selecionados" for multiple selections
  - Visual status indicators with colored circles
- **Status Change Functionality**: Added inline status modification capabilities
  - Dropdown menu for quick status changes directly from the table
  - Real-time status updates with immediate visual feedback
  - Integrated with existing status management system

### Tag System Enhancements
- **Dynamic Tag Colors**: Implemented dynamic color system for tags throughout the application
  - Tags now use colors defined in the tag registration system
  - Consistent color application across all components (AtaDetail, forms, lists)
  - Fallback color system for undefined tags
- **Tag Store Integration**: Enhanced tag management with Zustand store
  - Real-time tag loading and color synchronization
  - Improved performance with centralized tag state management

### Design System
- **OMNIA Color Palette**: Custom HSL-based color system defined in `index.css`
- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **Consistent Spacing**: Standardized padding, margins, and component sizing

## 📋 Padrões de Desenvolvimento

### Arquitetura de Código

#### 1. **Component Architecture**
```typescript
// Estrutura padrão de componente
export interface ComponentProps {
  // Props tipadas com TypeScript
}

export const Component: React.FC<ComponentProps> = ({ ...props }) => {
  // 1. Hooks (useState, useEffect, custom hooks)
  // 2. Computed values
  // 3. Event handlers
  // 4. Render
  return (
    <div className="responsive-classes">
      {/* JSX com acessibilidade */}
    </div>
  )
}
```

#### 2. **Store Pattern (Zustand)**
```typescript
// Store tipado com actions e state
interface StoreState {
  data: DataType[]
  loading: boolean
  error: string | null
}

interface StoreActions {
  fetchData: () => Promise<void>
  createItem: (item: CreateItemData) => Promise<void>
  updateItem: (id: string, data: UpdateItemData) => Promise<void>
  deleteItem: (id: string) => Promise<void>
}

export const useStore = create<StoreState & StoreActions>((set, get) => ({
  // State inicial
  data: [],
  loading: false,
  error: null,
  
  // Actions com error handling
  fetchData: async () => {
    set({ loading: true, error: null })
    try {
      const data = await repository.getAll()
      set({ data, loading: false })
    } catch (error) {
      set({ error: error.message, loading: false })
    }
  }
}))
```

#### 3. **Repository Pattern**
```typescript
// Interface do repositório
export interface Repository<T> {
  getAll(): Promise<T[]>
  getById(id: string): Promise<T | null>
  create(data: CreateData): Promise<T>
  update(id: string, data: UpdateData): Promise<T>
  delete(id: string): Promise<void>
}

// Implementação Supabase
export class SupabaseRepository implements Repository<DataType> {
  constructor(private supabase: SupabaseClient) {}
  
  async getAll(): Promise<DataType[]> {
    const { data, error } = await this.supabase
      .from('table_name')
      .select('*')
    
    if (error) throw new Error(error.message)
    return data || []
  }
}
```

### Guidelines de Código

#### TypeScript
- **Strict Mode**: Sempre ativado (`"strict": true`)
- **Tipagem Explícita**: Evitar `any`, usar tipos específicos
- **Interfaces vs Types**: Preferir `interface` para objetos, `type` para unions
- **Generics**: Usar para componentes e funções reutilizáveis
- **Utility Types**: Aproveitar `Partial`, `Pick`, `Omit`, etc.

```typescript
// ✅ Bom
interface User {
  id: string
  name: string
  email: string
  roles: UserRole[]
}

type CreateUserData = Omit<User, 'id'>
type UpdateUserData = Partial<CreateUserData>

// ❌ Evitar
const user: any = { /* ... */ }
```

#### React Patterns
- **Functional Components**: Sempre usar function components
- **Custom Hooks**: Extrair lógica reutilizável
- **Error Boundaries**: Implementar para componentes críticos
- **Memoization**: Usar `useMemo` e `useCallback` quando necessário
- **Props Drilling**: Evitar com Context API ou Zustand

```typescript
// ✅ Custom Hook
export const useAtas = () => {
  const store = useAtasStore()
  
  useEffect(() => {
    store.fetchAtas()
  }, [])
  
  return {
    atas: store.atas,
    loading: store.loading,
    createAta: store.createAta,
    updateAta: store.updateAta
  }
}

// ✅ Component usando o hook
export const AtasList: React.FC = () => {
  const { atas, loading, createAta } = useAtas()
  
  if (loading) return <LoadingSpinner />
  
  return (
    <div className="space-y-4">
      {atas.map(ata => (
        <AtaCard key={ata.id} ata={ata} />
      ))}
    </div>
  )
}
```

#### Styling & UI
- **Tailwind CSS**: Utility-first approach
- **Design System**: Usar tokens do OMNIA design system
- **Responsive Design**: Mobile-first com breakpoints
- **Acessibilidade**: ARIA labels, keyboard navigation
- **Dark Mode**: Suporte com `next-themes`

```typescript
// ✅ Componente com styling consistente
export const Button: React.FC<ButtonProps> = ({ 
  variant = 'default',
  size = 'md',
  children,
  ...props 
}) => {
  return (
    <button
      className={cn(
        // Base styles
        'inline-flex items-center justify-center rounded-md font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:pointer-events-none disabled:opacity-50',
        // Variants
        {
          'bg-primary text-primary-foreground hover:bg-primary/90': variant === 'default',
          'bg-destructive text-destructive-foreground hover:bg-destructive/90': variant === 'destructive',
        },
        // Sizes
        {
          'h-9 px-3 text-sm': size === 'sm',
          'h-10 px-4 py-2': size === 'md',
          'h-11 px-8': size === 'lg',
        }
      )}
      {...props}
    >
      {children}
    </button>
  )
}
```

### Fluxo de Dados

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Pages     │───►│   Stores    │───►│ Repositories│───►│  Supabase   │
│             │    │  (Zustand)  │    │  (Pattern)  │    │ (Database)  │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
       ▲                   ▲                   ▲                   │
       │                   │                   │                   │
       │            ┌─────────────┐    ┌─────────────┐              │
       └────────────│ Components  │    │   Hooks     │              │
                    │    (UI)     │    │ (Custom)    │              │
                    └─────────────┘    └─────────────┘              │
                           ▲                   ▲                   │
                           │                   │                   │
                           └───────────────────┘                   │
                                       │                           │
                                       ▼                           │
                               ┌─────────────┐                     │
                               │ Real-time   │◄────────────────────┘
                               │ Updates     │
                               └─────────────┘
```

1. **Pages** consomem dados dos Zustand stores
2. **Stores** usam repository pattern para acesso aos dados
3. **Repositories** fazem interface com Supabase
4. **Components** recebem props e emitem eventos
5. **Hooks** encapsulam lógica reutilizável
6. **Real-time** updates via Supabase subscriptions

### Validação e Formulários

```typescript
// Schema Zod para validação
export const ataSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório'),
  description: z.string().optional(),
  meetingDate: z.string().optional(),
  secretaryId: z.string().optional(),
  responsibleId: z.string().optional(),
  statusId: z.string().min(1, 'Status é obrigatório'),
  ticket: z.string().optional(),
  tags: z.array(z.string()).default([])
})

export type AtaFormData = z.infer<typeof ataSchema>

// Componente de formulário
export const AtaForm: React.FC<AtaFormProps> = ({ ata, onSubmit }) => {
  const form = useForm<AtaFormData>({
    resolver: zodResolver(ataSchema),
    defaultValues: ata || {
      title: '',
      description: '',
      tags: []
    }
  })
  
  const handleSubmit = (data: AtaFormData) => {
    onSubmit(data)
  }
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Título</FormLabel>
              <FormControl>
                <Input placeholder="Digite o título da ata" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* Outros campos */}
      </form>
    </Form>
  )
}
```

## 🔒 Segurança e Permissões

### Row Level Security (RLS)
O Omnia implementa controle de acesso granular através de políticas RLS do PostgreSQL:

```sql
-- Exemplo de política RLS para omnia_atas
CREATE POLICY "Users can view all atas" ON public.omnia_atas
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins and secretarios can create atas" ON public.omnia_atas
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.omnia_users 
      WHERE 'ADMIN' = ANY(roles) OR 'SECRETARIO' = ANY(roles)
    )
  );
```

### Sistema de Roles
- **ADMIN**: Acesso total ao sistema
- **SECRETARIO**: Pode criar e editar atas, gerenciar comentários
- **USUARIO**: Visualização e comentários limitados

### Validação de Dados
- **Frontend**: Validação com Zod schemas
- **Backend**: Constraints de banco de dados
- **Sanitização**: Prevenção de XSS e SQL injection
- **Upload de Arquivos**: Validação de tipo e tamanho

## ⚡ Performance e Otimização

### Frontend Optimizations
- **Code Splitting**: Lazy loading de rotas
- **Bundle Optimization**: Tree shaking com Vite
- **Image Optimization**: Lazy loading e formatos modernos
- **Memoization**: React.memo, useMemo, useCallback
- **Virtual Scrolling**: Para listas grandes

### Database Optimizations
- **Indexes**: Otimização de queries frequentes
- **Pagination**: Limit/offset para grandes datasets
- **Real-time**: Subscriptions otimizadas
- **Connection Pooling**: Gerenciamento eficiente de conexões

### Caching Strategy
```typescript
// Exemplo de cache com TanStack Query
export const useAtas = () => {
  return useQuery({
    queryKey: ['atas'],
    queryFn: () => atasRepository.getAll(),
    staleTime: 5 * 60 * 1000, // 5 minutos
    cacheTime: 10 * 60 * 1000, // 10 minutos
    refetchOnWindowFocus: false
  })
}
```

## 🧪 Testing e Quality Assurance

### Testing Strategy
- **Unit Tests**: Componentes e funções utilitárias
- **Integration Tests**: Fluxos de dados entre camadas
- **E2E Tests**: Jornadas críticas do usuário
- **Manual Testing**: Validação de UX e acessibilidade

### Code Quality
- **ESLint**: Linting com regras customizadas
- **Prettier**: Formatação automática
- **TypeScript**: Type checking rigoroso
- **Husky**: Git hooks para qualidade

### Performance Monitoring
- **Lighthouse**: Métricas de performance
- **Bundle Analyzer**: Análise de tamanho do bundle
- **Real User Monitoring**: Métricas de usuários reais

## 🚀 Deployment e DevOps

### Ambientes
- **Development**: Local com hot reload
- **Staging**: Preview de features
- **Production**: Ambiente live

### CI/CD Pipeline
1. **Code Push**: Trigger automático
2. **Quality Checks**: Linting, type checking
3. **Build**: Otimização e bundling
4. **Deploy**: Publicação automática
5. **Health Check**: Validação pós-deploy

### Deployment via Lovable
Simply open [Lovable](https://lovable.dev/projects/4c2091c0-2d80-4db8-8375-50b304a9ba25) and click on Share -> Publish.

#### Custom Domain
To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.
Read more: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)

### Environment Variables
```bash
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key

# Optional: Custom configurations
VITE_APP_NAME=Omnia
VITE_MAX_FILE_SIZE=10485760  # 10MB
```

## 🤝 Contributing

### Development Workflow
1. **Fork & Clone**: Criar fork do repositório
2. **Feature Branch**: `git checkout -b feature/nova-funcionalidade`
3. **Development**: Implementar seguindo guidelines
4. **Testing**: Validar funcionalidade e regressões
5. **Documentation**: Atualizar README e comentários
6. **Pull Request**: Submeter com descrição detalhada

### Commit Convention
```bash
# Formato: tipo(escopo): descrição
feat(atas): adicionar filtro por data
fix(auth): corrigir logout automático
docs(readme): atualizar guia de instalação
style(ui): ajustar espaçamento dos botões
refactor(store): simplificar lógica de estado
test(components): adicionar testes unitários
```

### Code Review Checklist
- [ ] Código segue padrões estabelecidos
- [ ] Tipagem TypeScript adequada
- [ ] Componentes acessíveis (ARIA)
- [ ] Performance otimizada
- [ ] Testes adequados
- [ ] Documentação atualizada
- [ ] Sem vazamentos de memória
- [ ] Responsividade mobile

### Testing Guidelines
- **Manual Testing**: Testar em desenvolvimento
- **Cross-browser**: Chrome, Firefox, Safari, Edge
- **Mobile Testing**: iOS Safari, Chrome Mobile
- **Accessibility**: Screen readers, keyboard navigation
- **Performance**: Lighthouse scores > 90

## 📚 Recursos Adicionais

### Documentação Técnica
- [Documentação das Atas](./atas.md) - Guia completo do sistema de atas
- [Supabase Docs](https://supabase.com/docs) - Documentação oficial
- [React Docs](https://react.dev) - Documentação do React
- [Tailwind CSS](https://tailwindcss.com/docs) - Guia de classes CSS

### Ferramentas de Desenvolvimento
- **VS Code Extensions**:
  - TypeScript Importer
  - Tailwind CSS IntelliSense
  - ES7+ React/Redux/React-Native snippets
  - Prettier - Code formatter
  - ESLint

### Troubleshooting
- **Build Errors**: Verificar versões de dependências
- **Type Errors**: Regenerar tipos do Supabase
- **Performance Issues**: Analisar bundle size
- **Auth Issues**: Verificar configuração RLS
- **Real-time Issues**: Verificar subscriptions Supabase
