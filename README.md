# OMNIA - Meeting Minutes Management System

## Project Overview

OMNIA is a comprehensive meeting minutes (atas) management system built with React and TypeScript. The application provides functionality for creating, editing, viewing, and managing meeting minutes with status tracking, user management, and tag organization.

**Project URL**: https://lovable.dev/projects/4c2091c0-2d80-4db8-8375-50b304a9ba25

## Architecture Overview

### Core Technologies
- **Frontend**: React 18 with TypeScript
- **Build Tool**: Vite with Hot Module Replacement (HMR)
- **Styling**: Tailwind CSS with custom OMNIA design system
- **UI Components**: Radix UI primitives with shadcn/ui
- **State Management**: Zustand stores with persistence
- **Backend**: Supabase (PostgreSQL database with real-time subscriptions)
- **Routing**: React Router DOM with nested routes
- **Form Handling**: React Hook Form with Zod validation
- **Data Fetching**: TanStack React Query for server state
- **Icons**: Lucide React for consistent iconography
- **Date Handling**: date-fns for date manipulation and formatting

### Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── atas/           # Ata-specific components
│   ├── auth/           # Authentication components
│   ├── layout/         # Layout components (TopBar, Sidebar)
│   ├── secretarios/    # Secretary management components
│   ├── status/         # Status management components
│   ├── tags/           # Tag management components
│   └── ui/             # Generic UI components (shadcn/ui)
├── contexts/           # React contexts
├── data/              # Static data and fixtures
├── hooks/             # Custom React hooks
├── integrations/      # External service integrations
│   └── supabase/      # Supabase client and types
├── lib/               # Utility functions
├── pages/             # Page components
├── repositories/      # Data access layer
├── store/             # Zustand state stores
└── main.tsx           # Application entry point
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

## Application Features

### Core Functionality
- **Meeting Minutes Management**: Create, edit, view, and delete meeting minutes (atas)
  - Rich text editing with comments and detailed information
  - Meeting date tracking and ticket number assignment
  - Export functionality for external sharing
- **Status Tracking**: Multi-status workflow management with visual indicators
  - Customizable status colors and ordering
  - Real-time status updates across all views
- **User Management**: Secretary assignment and user role management
  - Active/inactive user states
  - Role-based access control
- **Tag System**: Dynamic categorization and organization
  - Color-coded tags with visual consistency
  - Real-time tag synchronization across components
  - Bulk tag management and assignment
- **Search & Filtering**: Advanced filtering capabilities
  - Multi-select status filtering with visual indicators
  - Secretary-based filtering
  - Full-text search across titles and content
- **Multiple Views**: Flexible data presentation
  - Responsive table view with sortable columns
  - Kanban board for visual workflow management
- **File Attachments**: Document upload and management
  - Multiple file format support
  - Attachment preview and download

### Key Pages
- `/` - Dashboard with overview and quick actions
- `/atas` - Main atas listing with table/kanban views
- `/atas/new` - Create new meeting minutes
- `/atas/:id` - View ata details
- `/atas/:id/edit` - Edit existing ata
- `/config/status` - Status management
- `/config/tags` - Tag management
- `/config/usuarios` - User management

## Database Schema (Supabase)

### Core Tables
- **atas**: Meeting minutes records
  - `id`, `title`, `meeting_date`, `secretary_id`, `status_id`, `ticket`, `comments`, `created_at`, `updated_at`
- **status**: Status definitions
  - `id`, `name`, `color`, `order`
- **secretarios**: Secretary/user records
  - `id`, `name`, `email`, `active`
- **tags**: Tag definitions
  - `id`, `name`, `color`
- **ata_tags**: Many-to-many relationship between atas and tags

## Component Architecture

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

## Recent Changes & Improvements

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

### UI/UX Improvements
- **AtaDetail Layout**: Redesigned information layout for better visual hierarchy
  - Full-width "Informações Gerais" section matching comments section width
  - Removed redundant SVG icons (Calendar and User) for cleaner appearance
  - Enhanced visual distinction for meeting date and secretary information
- **Responsive Design**: Improved mobile and tablet compatibility
- **Color Consistency**: Standardized color usage across status and tag systems

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
