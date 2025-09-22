# Migração: Adição do Campo "Tipo" às Administradoras

## 📋 Resumo da Alteração

Esta migração adiciona um campo obrigatório **"tipo"** à tabela `omnia_administradoras` com as seguintes opções:
- **Administradora**
- **Contabilidade** 
- **Construtora**
- **Advogado**

## 🗂️ Arquivos Alterados

### Frontend
- `src/components/administradoras/AdminForm.tsx` - Formulário atualizado com campo tipo
- `src/repositories/administradorasRepo.supabase.ts` - Interfaces TypeScript atualizadas

### Backend
- `supabase/migrations/20250120000000_add_tipo_to_administradoras.sql` - Script de migração

## 🚨 Instruções de Aplicação Manual

### 1. Backup do Banco de Dados

**⚠️ OBRIGATÓRIO: Execute backup completo antes da migração**

```bash
# Exemplo para PostgreSQL local
pg_dump -h localhost -U postgres -d omnia_db > backup_pre_tipo_$(date +%Y%m%d_%H%M%S).sql

# Para Supabase (via CLI)
supabase db dump --file backup_pre_tipo_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Momento Ideal para Aplicação

**Horários Recomendados:**
- **Madrugada**: Entre 02:00 e 05:00
- **Finais de semana**: Sábado ou domingo de manhã
- **Feriados**: Quando há menor movimento de usuários

**Evitar:**
- Horário comercial (08:00 às 18:00)
- Início/fim do mês (maior movimento)
- Vésperas de feriados

### 3. Execução do Script

```sql
-- Conecte-se ao banco como superusuário
-- Execute o arquivo de migração:
\i supabase/migrations/20250120000000_add_tipo_to_administradoras.sql
```

**Ou via Supabase CLI:**
```bash
supabase migration up
```

### 4. Verificação do Sucesso

Execute os seguintes comandos para verificar se a migração foi aplicada corretamente:

```sql
-- 1. Verificar estrutura da tabela
\d omnia_administradoras

-- 2. Verificar constraint de valores
SELECT conname, consrc 
FROM pg_constraint 
WHERE conrelid = 'omnia_administradoras'::regclass 
AND conname = 'check_tipo_values';

-- 3. Verificar distribuição dos tipos
SELECT tipo, COUNT(*) as quantidade 
FROM omnia_administradoras 
GROUP BY tipo;

-- 4. Verificar se não há valores NULL (deve retornar 0)
SELECT COUNT(*) as registros_sem_tipo 
FROM omnia_administradoras 
WHERE tipo IS NULL;

-- 5. Verificar índice criado
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'omnia_administradoras' 
AND indexname = 'idx_omnia_administradoras_tipo';
```

### 5. Resultados Esperados

**Estrutura da Tabela:**
```
Column     | Type                     | Nullable | Default
-----------+--------------------------+----------+---------
id         | uuid                     | not null | gen_random_uuid()
nome       | character varying(255)   | not null | 
tipo       | character varying(50)    | not null | 
ativo      | boolean                  | not null | true
created_at | timestamp with time zone | not null | now()
updated_at | timestamp with time zone | not null | now()
```

**Constraints:**
- `check_tipo_values`: Garante valores permitidos
- `omnia_administradoras_pkey`: Chave primária
- `omnia_administradoras_tipo_not_null`: Campo obrigatório

**Índices:**
- `idx_omnia_administradoras_nome`
- `idx_omnia_administradoras_ativo` 
- `idx_omnia_administradoras_tipo` (novo)

## 🔄 Rollback (Em Caso de Problemas)

Se houver problemas, execute o rollback:

```sql
BEGIN;

-- Remover índice
DROP INDEX IF EXISTS idx_omnia_administradoras_tipo;

-- Remover constraint
ALTER TABLE omnia_administradoras DROP CONSTRAINT IF EXISTS check_tipo_values;

-- Remover coluna
ALTER TABLE omnia_administradoras DROP COLUMN IF EXISTS tipo;

COMMIT;
```

## 📞 Suporte

Em caso de dúvidas ou problemas:
1. Verifique os logs do banco de dados
2. Execute os comandos de verificação
3. Consulte a equipe de desenvolvimento
4. Mantenha o backup disponível para restauração

## ✅ Checklist de Execução

- [ ] Backup do banco realizado
- [ ] Horário de menor movimento confirmado
- [ ] Script de migração executado
- [ ] Verificações de sucesso realizadas
- [ ] Aplicação frontend testada
- [ ] Usuários notificados sobre a nova funcionalidade