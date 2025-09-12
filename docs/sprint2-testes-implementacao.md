# Sprint 2 - Implementação de Testes Unitários

## Resumo

Este documento descreve a implementação dos testes unitários para os hooks e stores do sistema OMNIA, seguindo as melhores práticas de teste e garantindo cobertura adequada das funcionalidades principais.

## Configuração do Ambiente de Testes

### Vitest Configuration

Foi criado o arquivo `vitest.config.ts` com as seguintes configurações:

- **Framework**: Vitest como test runner
- **Ambiente**: JSDOM para simular o DOM do navegador
- **Plugins**: React plugin para suporte a JSX/TSX
- **Globals**: Configuração para usar funções de teste globalmente
- **Setup**: Arquivo de configuração inicial dos testes
- **Aliases**: Mapeamento de paths para facilitar imports

### Setup de Testes

O arquivo `src/test/setup.ts` foi criado com:

- **Testing Library**: Configuração do @testing-library/jest-dom
- **Mocks do Supabase**: Mock automático do cliente Supabase
- **Console Logs**: Supressão de logs desnecessários durante os testes

### Scripts NPM

Foram adicionados os seguintes scripts ao `package.json`:

```json
{
  "test": "vitest",
  "test:ui": "vitest --ui",
  "test:run": "vitest run"
}
```

## Testes Implementados

### 1. Menu Items Store (`menuItems.store.test.ts`)

**Funcionalidades testadas:**
- Estado inicial do store
- Carregamento de itens de menu
- Estados de loading e error
- Operações CRUD (Create, Read, Update, Delete)
- Limpeza de erros

**Mocks utilizados:**
- Repository do Supabase (`menuItemsRepoSupabase`)
- Dados de teste com estrutura completa de MenuItem

### 2. User Permissions Store (`userPermissions.store.test.ts`)

**Funcionalidades testadas:**
- Estado inicial do store
- Carregamento de permissões por usuário
- Verificação de permissões de menu
- Operações CRUD de permissões
- Remoção de permissões por usuário e item de menu
- Carregamento de resumo de permissões
- Limpeza de estado

**Mocks utilizados:**
- Repository do Supabase (`userPermissionsRepoSupabase`)
- Dados de teste com estrutura completa de UserPermission

### 3. usePermissions Hook (`usePermissions.test.ts`)

**Funcionalidades testadas:**
- Retorno de dados de permissões
- Estados de loading e error
- Função de refresh
- Hook simplificado `useCanAccess`
- Hook simplificado `useCanAccessPath`

**Mocks utilizados:**
- Store de permissões de usuário
- Contexto de autenticação (AuthContext)

### 4. useMenuItems Hook (`useMenuItems.test.ts`)

**Funcionalidades testadas:**
- Retorno de dados de itens de menu
- Filtragem de itens acessíveis
- Estados de loading combinados (menu + permissões)
- Função de refresh
- Operações CRUD através do hook
- Funções utilitárias (getChildren, getAccessibleChildren)

**Mocks utilizados:**
- Store de itens de menu
- Hook de permissões (usePermissions)

## Padrões de Teste Adotados

### Estrutura dos Testes

1. **Arrange**: Configuração de mocks e estado inicial
2. **Act**: Execução da funcionalidade a ser testada
3. **Assert**: Verificação dos resultados esperados

### Mocking Strategy

- **Repositories**: Mockados completamente para isolar a lógica de negócio
- **External Dependencies**: Supabase client mockado globalmente
- **State Management**: Reset do estado entre testes para isolamento

### Cobertura de Cenários

- **Happy Path**: Cenários de sucesso
- **Error Handling**: Tratamento de erros e falhas
- **Loading States**: Estados de carregamento
- **Edge Cases**: Casos extremos e validações

## Dependências Instaladas

```json
{
  "@testing-library/jest-dom": "^6.6.3",
  "@testing-library/react": "^16.1.0",
  "jsdom": "^26.0.0",
  "vitest": "^2.1.8"
}
```

## Execução dos Testes

### Comandos Disponíveis

- `npm test`: Executa testes em modo watch
- `npm run test:run`: Executa testes uma vez
- `npm run test:ui`: Abre interface gráfica do Vitest

### Resultados Esperados

Os testes cobrem:
- **Stores**: Lógica de estado e operações assíncronas
- **Hooks**: Integração entre stores e componentes React
- **Error Handling**: Tratamento adequado de erros
- **Loading States**: Gerenciamento de estados de carregamento

## Próximos Passos

1. **Testes de Integração**: Implementar testes que validem a integração entre componentes
2. **Testes E2E**: Configurar Playwright para testes end-to-end
3. **Coverage Reports**: Configurar relatórios de cobertura de código
4. **CI/CD Integration**: Integrar testes no pipeline de deploy

## Considerações Técnicas

### Arquitetura de Testes

A estrutura de testes segue a arquitetura do projeto:

```
src/
├── stores/
│   └── __tests__/
│       ├── menuItems.store.test.ts
│       └── userPermissions.store.test.ts
├── hooks/
│   └── __tests__/
│       ├── usePermissions.test.ts
│       └── useMenuItems.test.ts
└── test/
    └── setup.ts
```

### Manutenibilidade

- **Mocks Centralizados**: Configuração de mocks no setup global
- **Helpers de Teste**: Funções utilitárias para criação de dados de teste
- **Isolamento**: Cada teste é independente e pode ser executado isoladamente

### Performance

- **Parallel Execution**: Testes executam em paralelo quando possível
- **Fast Feedback**: Modo watch para desenvolvimento rápido
- **Selective Testing**: Possibilidade de executar testes específicos

Esta implementação garante uma base sólida para testes unitários no projeto OMNIA, seguindo as melhores práticas da indústria e mantendo compatibilidade com a arquitetura existente.