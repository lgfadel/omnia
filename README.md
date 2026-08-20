# Omnia - Sistema de Gestão de Atas

Sistema moderno para gestão de atas de reunião com interface intuitiva e funcionalidades avançadas.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Acesse `http://localhost:8080`

## 🏗️ Arquitetura

### Stack Tecnológico
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Real-time)
- **State Management**: Zustand + React Hook Form
- **UI Components**: shadcn/ui + Radix UI

### Estrutura do Projeto
```
src/
├── components/          # Componentes reutilizáveis
│   ├── ui/             # Primitivos de UI (shadcn/ui)
│   ├── atas/           # Componentes específicos de atas
│   ├── layout/         # Layout (TopBar, Sidebar)
│   └── auth/           # Autenticação
├── pages/              # Páginas principais
├── stores/             # Estado global (Zustand)
├── repositories/       # Camada de dados (Repository Pattern)
├── hooks/              # Hooks customizados
├── data/              # Tipos TypeScript
└── lib/               # Utilitários
```

## ✨ Funcionalidades

### 🔐 Autenticação
- Login/logout seguro com Supabase Auth
- Sistema de roles (Admin, Secretário, Usuário)
- Recuperação de senha

### 📝 Gestão de Atas
- Criação e edição com códigos automáticos (A-XXXX)
- Sistema de status customizável
- Tags para categorização
- Busca e filtros avançados

### 💬 Colaboração
- Comentários com anexos
- Upload via drag & drop ou clipboard (Ctrl+V)
- Preview de imagens e documentos
- Notificações em tempo real

### 👥 Gestão de Usuários
- CRUD completo de usuários
- Sistema de permissões granular
- Perfis com avatares e cores personalizadas

## 🗄️ Banco de Dados

### Tabelas Principais
- `omnia_users` - Usuários com roles múltiplos
- `omnia_atas` - Atas de reunião
- `omnia_comments` - Comentários
- `omnia_attachments` - Anexos
- `omnia_statuses` - Status customizáveis

### Segurança
- Row Level Security (RLS) em todas as tabelas
- Políticas granulares por role
- Autenticação JWT obrigatória

## 🎨 Design System

### Cores
- Sistema de tokens semânticos
- Suporte a tema escuro/claro
- Paleta de 30 cores para personalização

### Componentes
- Design responsivo (mobile-first)
- Componentes acessíveis (ARIA)
- Feedback visual consistente

## 📊 Módulos Adicionais

- **CRM**: Gestão de leads e prospects
- **Tickets**: Sistema de tarefas com prioridades
- **Configurações**: Gestão de status, tags, usuários

## 🤝 Contribuindo

Veja [CONTRIBUTING.md](CONTRIBUTING.md) para guias de desenvolvimento.

## 🔧 Scripts Disponíveis

- `npm run dev` - Servidor de desenvolvimento
- `npm run build` - Build para produção
- `npm run preview` - Preview do build
- `npm run lint` - Análise de código

## 📚 Documentação Técnica

Para informações detalhadas sobre implementação:
- [atas.md](atas.md) - Sistema de atas
- [tarefas.md](tarefas.md) - Sistema de tarefas
- [docs/malotes-digitais.md](docs/malotes-digitais.md) - Operação e configuração de malotes digitais
- [docs/](docs/) - Documentação técnica específica
