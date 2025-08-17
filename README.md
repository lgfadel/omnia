# Omnia - Sistema de Gestão de Atas

Omnia é um sistema moderno de gestão de atas de reunião, desenvolvido com React, TypeScript e Supabase. O sistema oferece uma interface intuitiva para criação, edição e acompanhamento de atas, com sistema de comentários, anexos e controle de status.

**Project URL**: https://lovable.dev/projects/4c2091c0-2d80-4db8-8375-50b304a9ba25

## 🚀 Tecnologias Principais

- **Frontend**: React 18 + TypeScript + Vite
- **UI Framework**: shadcn/ui + Tailwind CSS + Radix UI
- **Backend**: Supabase (PostgreSQL + Auth + Storage + RLS)
- **State Management**: Zustand
- **Routing**: React Router DOM
- **Forms**: React Hook Form + Zod
- **Icons**: Lucide React
- **Drag & Drop**: @dnd-kit
- **Data Fetching**: TanStack Query
- **Styling**: Tailwind CSS + CVA (Class Variance Authority)

## 📁 Arquitetura do Projeto

```
src/
├── components/          # Componentes reutilizáveis
│   ├── atas/           # Componentes específicos de atas
│   ├── auth/           # Componentes de autenticação
│   ├── layout/         # Componentes de layout (TopBar, Sidebar)
│   ├── secretarios/    # Componentes de gestão de usuários
│   ├── status/         # Componentes de gestão de status
│   ├── tags/           # Componentes de gestão de tags
│   └── ui/             # Componentes UI genéricos (shadcn/ui)
├── contexts/           # Contextos React
├── data/              # Dados estáticos e fixtures
├── hooks/             # Hooks customizados
├── integrations/      # Integrações com serviços externos
│   └── supabase/      # Cliente e tipos do Supabase
├── lib/               # Funções utilitárias
├── pages/             # Componentes de página
├── repositories/      # Camada de acesso a dados
├── store/             # Stores do Zustand
└── main.tsx           # Ponto de entrada da aplicação
```

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

The development server runs on `http://localhost:8080/`

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

### Funcionalidades
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

### Table Enhancements
- **Column Removal**: Removed "Data Criação" column from atas table for cleaner layout
- **Column Width Optimization**: Adjusted column widths for better text fitting:
  - Título: 40% width
  - Data Assembleia: 36% width
  - Secretário: 36% width
  - Status: 28% width
  - Comentários: 16% width

### Filter Improvements
- **Multi-Select Status Filter**: Converted badge-based status filter to dropdown with checkboxes
  - Shows "Todos os status" when no filters selected
  - Shows single status name when one selected
  - Shows "X selecionados" for multiple selections
  - Visual status indicators with colored circles

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

## Development Guidelines

### Code Organization
- Use TypeScript for all new code
- Follow React functional component patterns
- Implement proper error boundaries
- Use Zustand for state management
- Leverage React Query for server state

### Styling Conventions
- Use Tailwind CSS classes
- Follow OMNIA design system colors
- Implement responsive design patterns
- Use shadcn/ui components as base

### Data Flow
1. **Pages** consume data from Zustand stores
2. **Stores** use repository pattern for data access
3. **Repositories** handle Supabase integration
4. **Components** receive props and emit events

## Deployment

Simply open [Lovable](https://lovable.dev/projects/4c2091c0-2d80-4db8-8375-50b304a9ba25) and click on Share -> Publish.

### Custom Domain
To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.
Read more: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)

## Contributing

### Development Workflow
1. Create feature branch from main
2. Implement changes following guidelines
3. Test thoroughly in development environment
4. Update this README with architectural changes
5. Submit pull request with detailed description

### Testing
- Manual testing in development server
- Cross-browser compatibility verification
- Mobile responsiveness testing
- Database operation validation
