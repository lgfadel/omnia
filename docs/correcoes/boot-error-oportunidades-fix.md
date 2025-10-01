# Correção do BOOT_ERROR - Edge Function Oportunidades

## Problema
A Edge Function `/oportunidades` estava apresentando `BOOT_ERROR` com a mensagem "Function failed to start (please check logs)".

## Causa Raiz
O erro foi causado por **imports incorretos** na Edge Function:

1. **Import do Supabase**: Estava usando `npm:@supabase/supabase-js@2` que não é compatível com o runtime do Supabase Edge Functions
2. **Função serve**: Estava usando `Deno.serve()` em vez da função `serve` importada do Deno std
3. **Referências a `userProfile`**: Código ainda referenciava variáveis da arquitetura de autenticação anterior

## Solução Implementada

### 1. Correção dos Imports
**Antes:**
```typescript
import { createClient } from 'npm:@supabase/supabase-js@2'
// ... código usando Deno.serve()
```

**Depois:**
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// ... código usando serve()
```

### 2. Atualização do deno.json
**Arquivo:** `/supabase/functions/oportunidades/deno.json`
```json
{
  "compilerOptions": {
    "allowJs": true,
    "lib": ["deno.window"],
    "strict": true
  },
  "imports": {
    "@supabase/supabase-js": "npm:@supabase/supabase-js@2"
  }
}
```

### 3. Correção da Função Principal
**Antes:**
```typescript
Deno.serve(async (req) => {
```

**Depois:**
```typescript
serve(async (req) => {
```

### 4. Remoção de Referências Obsoletas
Removidas todas as referências a `userProfile` que eram da arquitetura de autenticação anterior, mantendo apenas a validação JWT simplificada.

## Arquivos Modificados

1. **`/supabase/functions/oportunidades/index.ts`**
   - Corrigidos os imports
   - Atualizada a função serve
   - Removidas referências obsoletas

2. **`/supabase/functions/oportunidades/deno.json`**
   - Atualizado o mapeamento de imports

## Teste da Correção

Para testar a Edge Function corrigida, use:

```bash
curl -X GET "https://[SEU_PROJETO].supabase.co/functions/v1/oportunidades" \
  -H "Authorization: Bearer [SEU_JWT_TOKEN]" \
  -H "Content-Type: application/json"
```

## Padrão para Outras Edge Functions

Este padrão de imports deve ser seguido em todas as Edge Functions:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  // ... lógica da função
})
```

## Status
✅ **Resolvido** - Edge Function deve inicializar corretamente sem BOOT_ERROR

## Data
Janeiro 2025