# Guia de Contribuição - Omnia

## 📋 Padrões de Desenvolvimento

### Estrutura de Arquivos
- **Componentes**: PascalCase (`AtaForm.tsx`, `CommentsList.tsx`)
- **Hooks**: camelCase com prefixo `use-` (`use-mobile.ts`)
- **Stores**: camelCase com sufixo `.store.ts` (`atas.store.ts`)
- **Tipos**: Centralizados em `src/data/types.ts`

### Convenções de Código

#### TypeScript
```typescript
// ✅ Interface
interface Ata {
  id: string;
  title: string;
  createdAt: string;
}

// ✅ Tipo 
type AtaFormData = Pick<Ata, 'title' | 'description'>

// ✅ Enum
type Role = 'ADMIN' | 'SECRETARIO' | 'USUARIO'

// ✅ Constantes
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
```

#### Componentes React
```tsx
// ✅ Função com props tipadas
interface AtaCardProps {
  ata: Ata;
  onEdit?: (id: string) => void;
}

export function AtaCard({ ata, onEdit }: AtaCardProps) {
  // Hooks no topo
  const { user } = useAuth();
  
  // Event handlers
  const handleEdit = () => onEdit?.(ata.id);
  
  return (
    <Card>
      {/* JSX */}
    </Card>
  );
}
```

### Gerenciamento de Estado

#### Zustand Store Pattern
```typescript
interface AtasStore {
  // Estado
  atas: Ata[];
  loading: boolean;
  error: string | null;
  
  // Ações
  loadAtas: () => Promise<void>;
  createAta: (data: Partial<Ata>) => Promise<Ata>;
  updateAta: (id: string, data: Partial<Ata>) => Promise<void>;
  deleteAta: (id: string) => Promise<void>;
}

export const useAtasStore = create<AtasStore>((set, get) => ({
  atas: [],
  loading: false,
  error: null,
  
  loadAtas: async () => {
    set({ loading: true, error: null });
    try {
      const atas = await atasRepo.list();
      set({ atas, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },
  
  // ... outras ações
}));
```

#### Repository Pattern
```typescript
export const atasRepo = {
  async list(search?: string): Promise<Ata[]> {
    const { data, error } = await supabase
      .from('omnia_atas')
      .select('*')
      .ilike('title', `%${search || ''}%`);
      
    if (error) throw error;
    return data;
  },
  
  // ... outras operações CRUD
};
```

### Estilização

#### Design System
```tsx
// ✅ Use tokens semânticos do Tailwind config
<Button variant="primary" size="sm">
  Salvar
</Button>

// ❌ Não use cores diretas
<button className="bg-blue-500 text-white">
  Salvar  
</button>

// ✅ Use componentes do design system
<Badge variant="success">{status}</Badge>

// ✅ Classes responsivas
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
```

#### Variantes de Componentes
```typescript
// Em button.tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center transition-colors",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        success: "bg-success text-success-foreground hover:bg-success/90",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4",
        lg: "h-12 px-6 text-lg",
      }
    }
  }
)
```

### Formulários

#### React Hook Form + Zod
```typescript
const ataSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  description: z.string().optional(),
  statusId: z.string().min(1, "Status é obrigatório"),
});

type AtaFormData = z.infer<typeof ataSchema>;

export function AtaForm() {
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<AtaFormData>({
    resolver: zodResolver(ataSchema)
  });

  const onSubmit = async (data: AtaFormData) => {
    // Submissão
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Título *</Label>
        <Input
          id="title"
          {...register('title')}
          className={errors.title ? 'border-destructive' : ''}
        />
        {errors.title && (
          <p className="text-sm text-destructive">{errors.title.message}</p>
        )}
      </div>
    </form>
  );
}
```

### Error Handling

#### Tratamento de Erros
```typescript
// ✅ Use try/catch em operações assíncronas
const createAta = async (data: AtaFormData) => {
  try {
    const ata = await atasRepo.create(data);
    toast.success('Ata criada com sucesso!');
    return ata;
  } catch (error) {
    toast.error('Erro ao criar ata: ' + error.message);
    throw error;
  }
};

// ✅ Use error boundaries para erros de componente
<ErrorBoundary fallback={<ErrorFallback />}>
  <AtasList />
</ErrorBoundary>
```

### Performance

#### React.memo e useMemo
```typescript
// ✅ Memo para componentes pesados
export const AtaCard = memo(({ ata, onEdit }: AtaCardProps) => {
  return <Card>{/* ... */}</Card>;
});

// ✅ useMemo para cálculos custosos
const filteredAtas = useMemo(() => {
  return atas.filter(ata => 
    ata.title.toLowerCase().includes(search.toLowerCase())
  );
}, [atas, search]);

// ✅ useCallback para funções passadas como props
const handleEdit = useCallback((id: string) => {
  navigate(`/atas/${id}/edit`);
}, [navigate]);
```

## 🚀 Workflow de Desenvolvimento

### 1. Criar Nova Feature
```bash
# 1. Criar branch
git checkout -b feature/nova-funcionalidade

# 2. Implementar seguindo os padrões
# 3. Testar localmente
npm run dev

# 4. Fazer commit
git add .
git commit -m "feat: adiciona nova funcionalidade"

# 5. Push e PR
git push origin feature/nova-funcionalidade
```

### 2. Adicionar Novo Componente
```typescript
// 1. Criar em src/components/[categoria]/ComponentName.tsx
// 2. Exportar do index se necessário
// 3. Adicionar props interface tipada
// 4. Implementar com padrões do design system
// 5. Documentar props complexas
```

### 3. Adicionar Nova Página
```typescript
// 1. Criar em src/pages/PageName.tsx
// 2. Adicionar rota no router
// 3. Implementar com Layout wrapper
// 4. Adicionar ao menu se necessário
// 5. Configurar permissões RLS se privada
```

### 4. Adicionar Novo Store
```typescript
// 1. Criar em src/stores/entityName.store.ts
// 2. Seguir padrão de interface + create
// 3. Implementar CRUD básico
// 4. Adicionar error handling
// 5. Documentar estado complexo
```

## 🔍 Checklist de PR

### Code Quality
- [ ] Tipos TypeScript completos
- [ ] Sem `console.log` em produção (use `logger` do sistema)
- [ ] Error handling adequado
- [ ] Componentes com React.memo se necessário
- [ ] Nomes descritivos e convenções seguidas

### UI/UX
- [ ] Design system respeitado
- [ ] Responsividade testada
- [ ] Estados de loading/error implementados
- [ ] Feedback visual adequado (toasts)
- [ ] Acessibilidade básica (ARIA labels)

### Funcionalidade
- [ ] Validação de formulários
- [ ] Permissões RLS configuradas
- [ ] Testes manuais realizados
- [ ] Edge cases considerados
- [ ] Performance adequada

### Documentação
- [ ] README atualizado se necessário
- [ ] Comentários em lógica complexa
- [ ] Props interfaces documentadas
- [ ] Migrations SQL documentadas se aplicável

## 🛠️ Ferramentas Úteis

### VS Code Extensions
- TypeScript Importer
- Tailwind CSS IntelliSense
- ES7+ React/Redux/React-Native snippets
- Auto Rename Tag
- Bracket Pair Colorizer

### Debug
- React DevTools
- Supabase Dashboard
- Network tab para APIs
- Console para errors/warnings

## 📞 Suporte

Para dúvidas sobre padrões ou implementação:
1. Consulte este guia primeiro
2. Veja exemplos no código existente
3. Consulte documentação oficial das libs
4. Abra issue para discussão de novos padrões