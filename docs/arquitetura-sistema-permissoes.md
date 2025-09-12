# Arquitetura do Sistema de Permissões OMNIA

## Visão Geral

O sistema de permissões do OMNIA utiliza uma arquitetura de duas camadas:

1. **Permissões por Role** (`omnia_role_permissions`) - Permissões padrão baseadas no papel do usuário
2. **Permissões Específicas** (`omnia_user_permissions`) - Permissões individuais que sobrescrevem as padrões

## Tabelas Principais

### omnia_role_permissions
- **Propósito**: Define permissões padrão para cada role (ADMIN, SECRETARIO, USUARIO)
- **Estrutura**: `role_name`, `menu_item_id`, `can_access`
- **População**: Automaticamente populada via migrations com permissões padrão
- **Status**: ✅ **POPULADA** - Contém permissões para todos os roles

### omnia_user_permissions
- **Propósito**: Permissões específicas para usuários individuais
- **Estrutura**: `user_id`, `menu_item_id`, `can_access`, `granted_by`, `granted_at`
- **População**: Populada manualmente por administradores quando necessário
- **Status**: ✅ **VAZIA POR DESIGN** - Só é populada quando há exceções às regras padrão

## Lógica de Verificação de Permissões

A função `check_user_menu_permission()` segue esta ordem de prioridade:

1. **Verifica permissão específica do usuário** em `omnia_user_permissions`
   - Se existir, usa essa permissão (pode ser `true` ou `false`)
   - **Sobrescreve** qualquer permissão de role

2. **Se não há permissão específica, verifica permissões do role**
   - Consulta `omnia_role_permissions` baseado nos roles do usuário
   - Prioridade: ADMIN → SECRETARIO → USUARIO

3. **Se nenhuma permissão encontrada, nega acesso** (padrão seguro)

## Casos de Uso

### Cenário Normal
- Usuário com role `SECRETARIO` acessa `/atas`
- Sistema verifica `omnia_user_permissions` → não encontra
- Sistema verifica `omnia_role_permissions` → encontra `SECRETARIO + /atas = true`
- **Resultado**: Acesso permitido

### Cenário com Exceção
- Usuário com role `USUARIO` precisa acessar `/crm` (normalmente negado)
- Administrador cria registro em `omnia_user_permissions`: `user_id + /crm = true`
- Sistema verifica `omnia_user_permissions` → encontra permissão específica
- **Resultado**: Acesso permitido (sobrescreve regra do role)

### Cenário de Restrição
- Usuário com role `ADMIN` não deve acessar `/config/usuarios` temporariamente
- Administrador cria registro em `omnia_user_permissions`: `user_id + /config/usuarios = false`
- Sistema verifica `omnia_user_permissions` → encontra restrição específica
- **Resultado**: Acesso negado (sobrescreve regra do role)

## Permissões Padrão por Role

### ADMIN
- ✅ Acesso total a todas as funcionalidades
- ✅ Todas as páginas de configuração
- ✅ Gerenciamento de usuários

### SECRETARIO
- ✅ Dashboard, Atas, Tarefas, CRM, Relatórios
- ❌ Páginas de configuração
- ✅ Alterar própria senha

### USUARIO
- ✅ Dashboard, Atas, Tarefas
- ❌ CRM, Relatórios, Configurações
- ✅ Alterar própria senha

## Status Atual do Sistema

✅ **Sistema funcionando corretamente**
- Tabela `omnia_role_permissions` populada com permissões padrão
- Tabela `omnia_user_permissions` vazia (comportamento esperado)
- Funções de verificação de permissão operacionais
- RLS policies corrigidas e funcionais
- Sem erros de recursão infinita

## Manutenção

### Para adicionar nova página/funcionalidade:
1. Adicionar item em `omnia_menu_items`
2. Definir permissões padrão em `omnia_role_permissions`
3. Testar acesso com diferentes roles

### Para conceder permissão específica:
1. Inserir registro em `omnia_user_permissions`
2. Definir `user_id`, `menu_item_id`, `can_access`
3. Sistema automaticamente usará a permissão específica

### Para revogar permissão específica:
1. Deletar registro de `omnia_user_permissions`
2. Sistema voltará a usar permissão padrão do role

---

**Documentação atualizada em**: 2025-01-17  
**Status**: Sistema operacional e estável