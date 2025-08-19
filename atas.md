# Sistema de Atas - Documentação Técnica

## Visão Geral

O sistema de atas do Omnia é responsável pelo gerenciamento completo de atas de assembleias condominiais, incluindo criação, edição, comentários, anexos e controle de status. O sistema implementa autenticação baseada em roles, real-time updates e upload de arquivos.

## Arquitetura

### Estrutura de Diretórios

```
src/
├── components/atas/          # Componentes específicos de atas
│   ├── AtaForm.tsx          # Formulário de criação/edição
│   ├── AttachmentsList.tsx  # Lista de anexos
│   ├── CommentInput.tsx     # Input para comentários
│   ├── CommentsList.tsx     # Lista de comentários
│   ├── FileUploader.tsx     # Upload de arquivos
│   ├── StatusSelect.tsx     # Seletor de status
│   └── TagInput.tsx         # Input de tags
├── pages/
│   ├── Atas.tsx            # Página principal de listagem
│   ├── AtaDetail.tsx       # Página de detalhes da ata
│   └── AtaEdit.tsx         # Página de edição
├── store/
│   └── atas.store.ts       # Store Zustand para gerenciamento de estado
└── repositories/
    └── atasRepo.supabase.ts # Repository para operações com Supabase
```

### Padrões Arquiteturais

- **Repository Pattern**: Abstração das operações de banco de dados
- **Store Pattern (Zustand)**: Gerenciamento de estado global
- **Component Composition**: Componentes reutilizáveis e modulares
- **Custom Hooks**: Lógica reutilizável encapsulada
- **Context API**: Compartilhamento de dados entre componentes
- **Query Pattern**: Otimização de consultas e cache

## Banco de Dados

### Tabelas Principais

#### omnia_atas
```sql
CREATE TABLE public.omnia_atas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE, -- A-0001, A-0002, etc.
  title TEXT NOT NULL,
  description TEXT,
  meeting_date DATE,
  secretary_id UUID REFERENCES public.omnia_users(id),
  status_id UUID REFERENCES public.omnia_statuses(id) NOT NULL,
  ticket TEXT,
  tags TEXT[] DEFAULT '{}',
  comment_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
```

#### omnia_comments
```sql
CREATE TABLE public.omnia_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ata_id UUID REFERENCES public.omnia_atas(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES public.omnia_users(id) NOT NULL,
  body TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
```

#### omnia_attachments
```sql
CREATE TABLE public.omnia_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ata_id UUID REFERENCES public.omnia_atas(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.omnia_comments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  size_kb INTEGER,
  mime_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
```

#### omnia_statuses
```sql
CREATE TABLE public.omnia_statuses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  order_position INTEGER NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
```

#### omnia_users
```sql
CREATE TABLE public.omnia_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  role TEXT DEFAULT 'LEITOR' CHECK (role IN ('ADMIN', 'SECRETARIO', 'LEITOR')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
```

### Triggers e Funções

#### Atualização Automática de Timestamps
```sql
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_omnia_atas_updated_at
  BEFORE UPDATE ON public.omnia_atas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
```

#### Contagem Automática de Comentários
```sql
CREATE OR REPLACE FUNCTION public.update_ata_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.omnia_atas 
    SET comment_count = comment_count + 1 
    WHERE id = NEW.ata_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.omnia_atas 
    SET comment_count = comment_count - 1 
    WHERE id = OLD.ata_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_comment_count_trigger
  AFTER INSERT OR DELETE ON public.omnia_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ata_comment_count();
```

### Row Level Security (RLS)

#### Políticas para omnia_atas
```sql
-- Visualização: Todos os usuários autenticados
CREATE POLICY "Anyone can view atas" ON public.omnia_atas
  FOR SELECT USING (auth.role() = 'authenticated');

-- Criação: Apenas SECRETARIO e ADMIN
CREATE POLICY "Secretarios and Admins can create atas" ON public.omnia_atas
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.omnia_users 
      WHERE auth_user_id = auth.uid() AND role IN ('ADMIN', 'SECRETARIO')
    )
  );

-- Atualização: Apenas SECRETARIO e ADMIN
CREATE POLICY "Secretarios and Admins can update atas" ON public.omnia_atas
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.omnia_users 
      WHERE auth_user_id = auth.uid() AND role IN ('ADMIN', 'SECRETARIO')
    )
  );

-- Exclusão: Apenas ADMIN
CREATE POLICY "Admins can delete atas" ON public.omnia_atas
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.omnia_users 
      WHERE auth_user_id = auth.uid() AND role = 'ADMIN'
    )
  );
```

#### Políticas para omnia_comments
```sql
-- Visualização: Todos os usuários autenticados
CREATE POLICY "Anyone can view comments" ON public.omnia_comments
  FOR SELECT USING (auth.role() = 'authenticated');

-- Criação: Todos os usuários autenticados
CREATE POLICY "Authenticated users can create comments" ON public.omnia_comments
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Atualização: Próprio autor ou ADMIN
CREATE POLICY "Users can update their own comments" ON public.omnia_comments
  FOR UPDATE USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.omnia_users 
      WHERE auth_user_id = auth.uid() AND role = 'ADMIN'
    )
  );

-- Exclusão: Próprio autor ou ADMIN
CREATE POLICY "Users can delete their own comments or admins can delete any" ON public.omnia_comments
  FOR DELETE USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.omnia_users 
      WHERE auth_user_id = auth.uid() AND role = 'ADMIN'
    )
  );
```

### Real-time Updates

```sql
-- Configuração para atualizações em tempo real
ALTER PUBLICATION supabase_realtime ADD TABLE public.omnia_atas;
```

## Tipos e Interfaces TypeScript

### Interface Principal - Ata
```typescript
export interface Ata {
  id: string;
  title: string;
  description?: string;
  meetingDate?: string;
  createdAt: string;
  updatedAt: string;
  secretary?: UserRef;
  responsible?: UserRef;
  statusId: string;
  ticket?: string;
  tags?: string[];
  commentCount?: number;
  attachments?: Attachment[];
  comments?: Comment[];
}
```

### Interfaces Relacionadas
```typescript
export interface Status {
  id: string;
  name: string;
  color: string;
  order: number;
  isDefault?: boolean;
}

export interface UserRef {
  id: string;
  name: string;
  email: string;
  roles: Role[];
  avatarUrl?: string;
  color?: string;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  sizeKB?: number;
  mime?: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  author: UserRef;
  body: string;
  createdAt: string;
  attachments?: Attachment[];
}

export type Role = 'ADMIN' | 'SECRETARIO' | 'USUARIO';
```

### Schema de Validação (Zod)
```typescript
const ataSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  description: z.string().optional(),
  meetingDate: z.string().optional(),
  secretaryId: z.string().optional(),
  responsibleId: z.string().optional(),
  statusId: z.string().min(1, "Status é obrigatório"),
  ticket: z.string().optional(),
  tags: z.string().optional()
});
```

## Store (Zustand)

### Interface do Store
```typescript
interface AtasStore {
  // Estado
  atas: Ata[];
  statuses: Status[];
  loading: boolean;
  error: string | null;
  
  // Ações para Atas
  loadAtas: () => Promise<void>;
  createAta: (ata: Omit<Ata, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateAta: (id: string, ata: Partial<Ata>) => Promise<void>;
  deleteAta: (id: string) => Promise<void>;
  
  // Ações para Comentários
  addComment: (ataId: string, comment: Omit<Comment, 'id' | 'createdAt'>) => Promise<void>;
  deleteComment: (ataId: string, commentId: string) => Promise<void>;
  
  // Ações para Anexos
  addAttachment: (ataId: string, attachment: Omit<Attachment, 'id' | 'createdAt'>) => Promise<void>;
  deleteAttachment: (ataId: string, attachmentId: string) => Promise<void>;
  
  // Utilitários
  clearError: () => void;
}
```

## Repository Pattern

### Principais Métodos
```typescript
class AtasRepoSupabase {
  // Operações CRUD para Atas
  async list(): Promise<Ata[]>
  async getById(id: string): Promise<Ata | null>
  async create(ata: Omit<Ata, 'id' | 'createdAt' | 'updatedAt'>): Promise<Ata>
  async update(id: string, ata: Partial<Ata>): Promise<Ata>
  async remove(id: string): Promise<void>
  
  // Operações para Comentários
  async addComment(ataId: string, comment: Omit<Comment, 'id' | 'createdAt'>): Promise<Comment>
  async removeComment(commentId: string): Promise<void>
  
  // Operações para Anexos
  async addAttachment(ataId: string, attachment: Omit<Attachment, 'id' | 'createdAt'>): Promise<Attachment>
  async removeAttachment(attachmentId: string): Promise<void>
  
  // Transformações de Dados
  private transformDbAtaToAta(dbAta: any): Ata
  private transformDbCommentToComment(dbComment: any): Comment
  private transformDbAttachmentToAttachment(dbAttachment: any): Attachment
}
```

## Componentes

### AtaForm.tsx
**Responsabilidade**: Formulário para criação e edição de atas

**Props**:
- `ata?: Ata` - Ata para edição (opcional)
- `onSubmit: (data: AtaFormData) => void` - Callback de submissão
- `onCancel: () => void` - Callback de cancelamento
- `loading?: boolean` - Estado de carregamento

**Funcionalidades**:
- Validação com React Hook Form + Zod
- Seleção de secretário e responsável
- Gerenciamento de tags
- Seleção de status
- Campo de data da assembleia

### AtaDetail.tsx
**Responsabilidade**: Exibição detalhada de uma ata

**Funcionalidades**:
- Exibição de informações da ata
- Lista de comentários
- Lista de anexos
- Adição de novos comentários
- Upload de anexos
- Botões de ação (editar, excluir)

### Atas.tsx
**Responsabilidade**: Página principal de listagem de atas

**Funcionalidades**:
- Listagem paginada de atas
- Filtros por status e busca
- Agrupamento por status
- Botão "Minhas Atas" (circular amarelo)
- Real-time updates via Supabase
- Ordenação e agrupamento de dados

## Design e Estilos

### Sistema de Cores
- **Status Padrão**: `#F59E0B` (Amarelo/Laranja)
- **Em Revisão**: `#FBBF24` (Amarelo claro)
- **Em Andamento**: `#3B82F6` (Azul)
- **Concluído**: `#10B981` (Verde)
- **Cancelado**: `#EF4444` (Vermelho)
- **Pendente**: `#8B5CF6` (Roxo)

### Botão Circular "Minhas Atas"
```tsx
<button
  onClick={() => setShowOnlyMyAtas(!showOnlyMyAtas)}
  className={`
    w-12 h-12 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-200
    ${showOnlyMyAtas 
      ? 'bg-yellow-400 text-yellow-900 shadow-lg ring-2 ring-yellow-300' 
      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
    }
  `}
  title="Filtrar minhas atas"
>
  {userInitials || <User className="w-5 h-5" />}
</button>
```

### Componentes de UI
- **shadcn/ui**: Sistema de componentes base
- **Tailwind CSS**: Framework de estilos
- **Lucide React**: Ícones
- **React Hook Form**: Formulários
- **Zod**: Validação de esquemas

## Funcionalidades Principais

### 1. Gerenciamento de Atas
- ✅ Criação de novas atas
- ✅ Edição de atas existentes
- ✅ Exclusão de atas (apenas ADMIN)
- ✅ Listagem com filtros e busca
- ✅ Agrupamento por status
- ✅ Filtro "Minhas Atas"

### 2. Sistema de Comentários
- ✅ Adição de comentários
- ✅ Exclusão de comentários próprios
- ✅ Contagem automática de comentários
- ✅ Exibição de autor e data

### 3. Gerenciamento de Anexos
- ✅ Upload de arquivos
- ✅ Download de anexos
- ✅ Exclusão de anexos
- ✅ Suporte a múltiplos tipos de arquivo
- ✅ Informações de tamanho e tipo MIME

### 4. Sistema de Status
- ✅ Status predefinidos
- ✅ Cores personalizadas
- ✅ Ordenação por posição
- ✅ Status padrão

### 5. Controle de Acesso
- ✅ Autenticação obrigatória
- ✅ Roles: ADMIN, SECRETARIO, USUARIO
- ✅ Permissões granulares via RLS
- ✅ Proteção de rotas

### 6. Real-time Updates
- ✅ Atualizações automáticas via Supabase
- ✅ Sincronização entre múltiplos usuários
- ✅ Notificações de mudanças

## Migrações Importantes

### 20250815014608 - Criação das Tabelas Base
- Criação de todas as tabelas principais
- Configuração de RLS
- Inserção de dados iniciais de status
- Criação de triggers e funções

### 20250819180741 - Ajuste de Políticas RLS
- Permitir que USUARIO role crie e atualize atas
- Ajustes nas permissões de acesso

### 20250819181908 - Configuração Real-time
- Habilitação de real-time updates para omnia_atas
- Configuração de publicação Supabase

### 20250819215021 - Separação de Comentários e Anexos
- Criação de tabelas separadas para tickets
- Migração de dados existentes
- Novos triggers e políticas RLS

## Troubleshooting

### Problemas Comuns

1. **Erro de Permissão RLS**
   - Verificar se o usuário tem role adequada
   - Confirmar políticas RLS ativas
   - Validar autenticação Supabase

2. **Real-time não Funciona**
   - Verificar configuração de publicação
   - Confirmar listener ativo no componente
   - Validar conexão WebSocket

3. **Upload de Arquivo Falha**
   - Verificar configuração do bucket Supabase
   - Confirmar políticas de storage
   - Validar tamanho e tipo do arquivo

4. **Contagem de Comentários Incorreta**
   - Verificar triggers ativos
   - Executar recontagem manual se necessário
   - Confirmar integridade referencial

### Comandos Úteis

```sql
-- Recontagem manual de comentários
UPDATE public.omnia_atas 
SET comment_count = (
  SELECT COUNT(*) 
  FROM public.omnia_comments 
  WHERE ata_id = omnia_atas.id
);

-- Verificar políticas RLS ativas
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public' AND tablename LIKE 'omnia_%';

-- Verificar triggers ativos
SELECT trigger_name, event_manipulation, event_object_table 
FROM information_schema.triggers 
WHERE event_object_schema = 'public' AND event_object_table LIKE 'omnia_%';
```

## Próximas Melhorias

### Funcionalidades Planejadas
- [ ] Notificações push para novos comentários
- [ ] Histórico de alterações (audit log)
- [ ] Templates de atas
- [ ] Assinatura digital
- [ ] Exportação para PDF
- [ ] Integração com calendário
- [ ] Workflow de aprovação
- [ ] Versionamento de atas

### Otimizações Técnicas
- [ ] Cache de consultas frequentes
- [ ] Paginação server-side
- [ ] Compressão de imagens
- [ ] Lazy loading de componentes
- [ ] Service Worker para offline
- [ ] Otimização de bundle size

---

**Última atualização**: Janeiro 2025  
**Versão**: 1.0.0  
**Autor**: Sistema Omnia