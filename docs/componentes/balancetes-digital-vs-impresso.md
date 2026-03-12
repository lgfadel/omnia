# Balancetes: Digital vs Impresso

## Visão Geral

O sistema diferencia o cadastro de balancetes baseado no tipo de recebimento configurado no condomínio:

- **Balancete Impresso** (`balancete_digital = false`)
- **Balancete Digital** (`balancete_digital = true`)

## Comportamento por Tipo

### Balancete Impresso (Padrão)

Quando o condomínio **não** possui balancete digital (`balancete_digital = false`):

- **Data de Recebimento**: Campo editável que registra quando o balancete físico foi recebido
- **Volumes**: Campo numérico editável (mínimo 1), permite registrar múltiplos volumes
- **Comportamento**: Configuração padrão para condomínios que recebem documentação física

### Balancete Digital

Quando o condomínio possui balancete digital (`balancete_digital = true`):

- **Data de Publicação**: O campo muda de "Data de Recebimento" para "Data de Publicação"
- **Volumes**: Sempre fixo em 1 (campo desabilitado)
- **Indicador Visual**: Badge azul informando que o condomínio recebe balancete digital
- **Comportamento**: Otimizado para documentos digitais que não possuem múltiplos volumes físicos

## Implementação Técnica

### Componente: BalanceteForm

**Localização**: `apps/web-next/src/components/balancetes/BalanceteForm.tsx`

#### Lógica de Detecção

```typescript
const selectedCondominium = condominiums.find(c => c.id === condominiumId);
const isDigital = selectedCondominium?.balancete_digital ?? false;
```

#### Adaptação de Labels

```typescript
<Label htmlFor="received_at">
  {isDigital ? "Data de Publicação *" : "Data de Recebimento *"}
</Label>
```

#### Controle de Volumes

```typescript
<Input
  id="volumes"
  type="number"
  min={1}
  {...register("volumes", { valueAsNumber: true })}
  disabled={isDigital}
  value={isDigital ? 1 : undefined}
/>
```

#### Auto-ajuste de Volumes

```typescript
useEffect(() => {
  if (isDigital && !isEditing) {
    setValue("volumes", 1);
  }
}, [isDigital, isEditing, setValue]);
```

## Banco de Dados

### Tabela: omnia_condominiums

Campo relevante:
- `balancete_digital` (BOOLEAN, DEFAULT false): Indica se o condomínio recebe balancete digital

### Tabela: omnia_balancetes

Campos afetados:
- `received_at` (DATE): Armazena data de recebimento (impresso) ou publicação (digital)
- `volumes` (INTEGER, DEFAULT 1): Número de volumes (sempre 1 para digital)

## UX/UI

### Indicador Visual

Quando um condomínio digital é selecionado, aparece um badge informativo:

```
ℹ️ Este condomínio recebe balancete digital
```

### Mensagens de Ajuda

- **Digital - Data**: "Para balancetes digitais, informe a data de publicação"
- **Digital - Volumes**: "Balancetes digitais sempre possuem 1 volume"

## Fluxo de Uso

1. Usuário abre o formulário de cadastro de balancete
2. Seleciona um condomínio
3. Sistema verifica se `balancete_digital = true`
4. Se digital:
   - Exibe badge informativo
   - Muda label para "Data de Publicação"
   - Desabilita campo de volumes e fixa em 1
   - Exibe mensagens de ajuda contextuais
5. Usuário preenche os dados e salva

## Configuração no Cadastro de Condomínios

O campo `balancete_digital` é configurado no formulário de cadastro/edição de condomínios:

**Localização**: `apps/web-next/src/components/condominiums/CondominiumForm.tsx`

```typescript
<div className="flex items-center justify-between space-x-2">
  <Label htmlFor="balancete_digital">Balancete Digital</Label>
  <Switch
    id="balancete_digital"
    checked={watch("balancete_digital")}
    onCheckedChange={(checked) => setValue("balancete_digital", checked)}
    disabled={isLoading}
  />
</div>
```

## Migração

A funcionalidade foi adicionada via migration:

**Arquivo**: `supabase/migrations/20260312200100_add_condominium_balancete_boleto_toggles.sql`

```sql
ALTER TABLE omnia_condominiums
  ADD COLUMN balancete_digital BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN boleto_impresso BOOLEAN NOT NULL DEFAULT false;
```

Todos os condomínios existentes receberam `balancete_digital = false` por padrão.
