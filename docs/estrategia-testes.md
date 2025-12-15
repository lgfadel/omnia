# Estratégia de Testes - OMNIA

## Visão Geral

Este documento consolida a estratégia de testes do sistema OMNIA, incluindo testes unitários, de componentes, E2E e regressão visual.

---

## Configuração do Ambiente

### Vitest (Testes Unitários e Componentes)

```typescript
// vitest.config.ts
export default {
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts']
  }
}
```

### Playwright (E2E e Visual Regression)

```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:8080',
    headless: true,
    screenshot: 'only-on-failure'
  }
})
```

---

## Scripts NPM

```json
{
  "test": "vitest",
  "test:run": "vitest run",
  "test:ui": "vitest --ui",
  "test:e2e": "playwright test",
  "test:visual": "playwright test --config=playwright.visual.config.ts",
  "test:visual:update": "playwright test --config=playwright.visual.config.ts --update-snapshots"
}
```

---

## Cobertura por Camada

### 1. Testes Unitários (Stores e Hooks)

| Arquivo | Funcionalidades Testadas |
|---------|-------------------------|
| `menuItems.store.test.ts` | Estado inicial, CRUD, loading/error |
| `userPermissions.store.test.ts` | Permissões por usuário, verificações de acesso |
| `usePermissions.test.ts` | Hooks de permissão, `useCanAccess`, `useCanAccessPath` |
| `useMenuItems.test.ts` | Itens acessíveis, filtragem, operações CRUD |

### 2. Testes de Componentes

| Arquivo | Funcionalidades Testadas |
|---------|-------------------------|
| `Auth.test.tsx` | Login, logout, estados de loading/error |
| `AuthContext.test.tsx` | Contexto de autenticação |
| `AppSidebar.test.tsx` | Menu lateral, responsividade |

### 3. Testes E2E

| Cenário | Descrição |
|---------|-----------|
| Autenticação | Login → Dashboard → Logout |
| Navegação | Fluxo entre páginas principais |
| CRUD | Criação, edição, exclusão de entidades |
| Permissões | Acesso baseado em roles |

### 4. Visual Regression

| Screenshot | Viewport |
|------------|----------|
| `homepage-desktop.png` | 1920x1080 |
| `homepage-tablet.png` | 768x1024 |
| `homepage-mobile.png` | 375x667 |

---

## Padrões de Teste

### Estrutura AAA

```typescript
describe('ComponentName', () => {
  it('should do something', () => {
    // Arrange - Setup
    const mockData = {...}
    
    // Act - Execução
    render(<Component />)
    
    // Assert - Verificação
    expect(screen.getByText('...')).toBeInTheDocument()
  })
})
```

### Mocking Strategy

```typescript
// Setup global em src/test/setup.ts
vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabaseClient
}))
```

---

## Métricas de Qualidade

- **Cobertura Total**: >85%
- **Performance**: Execução completa <5 minutos
- **Estabilidade**: Taxa de sucesso >98%

---

## CI/CD Integration

```yaml
# .github/workflows/tests.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run test:run
      - run: npx playwright install
      - run: npm run test:e2e
```

---

**Última atualização**: Dezembro 2024
