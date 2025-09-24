# 🔍 Diagnóstico: Campo oportunidade_id não está sendo gravado

## Status Atual
Implementei **logs detalhados** em todo o fluxo para identificar onde está o problema. Agora precisamos testar e analisar os logs.

## 📋 Passos para Diagnóstico

### 1. Verificar se a coluna existe no banco de dados

**Opção A - Via SQL direto:**
```sql
-- Execute no seu cliente PostgreSQL/Supabase
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'omnia_tickets' 
  AND column_name = 'oportunidade_id';
```

**Opção B - Via script de teste:**
```bash
# Configure as variáveis de ambiente primeiro
export VITE_SUPABASE_URL="sua_url_supabase"
export VITE_SUPABASE_ANON_KEY="sua_chave_anonima"

# Execute o script de teste
node test-oportunidade-column.js
```

### 2. Testar a funcionalidade com logs

1. **Abra o console do navegador** (F12 → Console)
2. **Acesse a página de criação de tarefas** (http://localhost:8080/tickets/new)
3. **Preencha o formulário** incluindo uma oportunidade
4. **Clique em Salvar**
5. **Observe os logs no console**

### 3. Analisar os logs

Procure por estas mensagens no console:

#### 🟢 Logs do Formulário:
```
🔍 DEBUG FORM - Dados do formulário: {...}
🔍 DEBUG FORM - oportunidadeId do form: "valor_aqui"
🔍 DEBUG FORM - tipo do oportunidadeId: string
🔍 DEBUG FORM - ticketData final: {...}
🔍 DEBUG FORM - oportunidadeId no ticketData: "valor_aqui"
```

#### 🟡 Logs do Repositório:
```
🔍 DEBUG - oportunidadeId recebido: "valor_aqui"
🔍 DEBUG - tipo do oportunidadeId: string
🔍 DEBUG - insertData completo: {...}
🔍 DEBUG - oportunidade_id no insertData: "valor_aqui"
🔍 DEBUG - Resposta do Supabase: {...}
```

#### 🔴 Possíveis Erros:
```
❌ Error creating tarefa: {...}
❌ Error details: {...}
```

## 🚨 Cenários Possíveis

### Cenário 1: Coluna não existe
**Sintomas:**
- Erro: `column "oportunidade_id" does not exist`
- Logs param até o Supabase, mas falha na inserção

**Solução:**
```bash
# Execute as migrações SQL
psql -d sua_database -f scripts/sql/add_oportunidade_id_column.sql
psql -d sua_database -f scripts/sql/add_foreign_key_constraint.sql
```

### Cenário 2: Problema de permissão RLS
**Sintomas:**
- Inserção "funciona" mas dados não aparecem
- Sem erros explícitos

**Solução:**
```sql
-- Verificar políticas RLS
SELECT * FROM pg_policies WHERE tablename = 'omnia_tickets';

-- Temporariamente desabilitar RLS para teste
ALTER TABLE omnia_tickets DISABLE ROW LEVEL SECURITY;
-- TESTE A FUNCIONALIDADE
-- REABILITAR DEPOIS:
ALTER TABLE omnia_tickets ENABLE ROW LEVEL SECURITY;
```

### Cenário 3: Problema no formulário
**Sintomas:**
- `oportunidadeId` aparece como `undefined` ou `""` nos logs

**Solução:**
- Verificar se o componente `OportunidadeSelect` está funcionando
- Verificar se o valor está sendo setado no formulário

### Cenário 4: Problema na transformação
**Sintomas:**
- Dados chegam ao Supabase mas não são retornados corretamente

**Solução:**
- Verificar função `transformTarefaFromDB`

## 📊 Próximos Passos

1. **Execute o diagnóstico** seguindo os passos acima
2. **Copie e cole os logs** que aparecem no console
3. **Informe qual cenário** se aplica ao seu caso
4. **Compartilhe os resultados** para que eu possa ajudar com a solução específica

## 🛠️ Arquivos Modificados

- ✅ `src/components/tickets/TicketForm.tsx` - Logs do formulário
- ✅ `src/repositories/tarefasRepo.supabase.ts` - Logs do repositório
- ✅ `test-oportunidade-column.js` - Script de teste
- ✅ `scripts/sql/verify_oportunidade_id_column.sql` - Verificação SQL

---

**Execute os testes e me informe os resultados!** 🚀