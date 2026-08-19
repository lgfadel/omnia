# Arquivo do histórico de migrations

Estas 55 migrations foram aplicadas em produção pelo dashboard do Supabase e
nunca tiveram arquivo correspondente em `supabase/migrations/`. O SQL aqui foi
extraído de `supabase_migrations.schema_migrations.statements` antes de os
registros serem removidos com `supabase migration repair --status reverted`.

**Nada aqui é executado.** O diretório existe só para preservar a origem de
mudanças que já estão no schema de produção. Os efeitos dessas migrations já
estão cobertos pelos arquivos em `supabase/migrations/`, que foram reconciliados
com o banco em 19/08/2026 e marcados como aplicados.

Contexto do drift: o histórico local e o remoto tinham divergido a ponto de só
2 de 93 migrations estarem em sincronia, o que travava `supabase db push`. Parte
da divergência era o mesmo arquivo registrado com 12 h de diferença no timestamp;
o resto era SQL aplicado direto pelo dashboard.
