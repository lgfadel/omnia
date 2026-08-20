# Ambiente local de testes

O baseline local é um Supabase isolado e idempotente, destinado a testar a UI
com o mesmo modo de execução usado em produção (`next build` + `next start`).
Os dados são sintéticos e reproduzem os contratos de dados consumidos pelo
aplicativo; nenhum dado de produção é copiado para a máquina de desenvolvimento.

```bash
npm run local:test:up
npm run local:test:verify
npm run local:test:app
```

Endereços locais: UI `http://localhost:3000`, API `http://127.0.0.1:55421`,
Studio `http://127.0.0.1:55423` e Mailpit `http://127.0.0.1:55424`.

Credenciais de teste: `admin@omnia.local` / `senha-local-omnia`.

`local:test:up` aplica as fixtures em sequência e pode ser repetido: cria ou
atualiza schema, permissões, configurações de malotes e os dados dummy. O
usuário padrão é administrador e possui permissões de leitura e escrita para
testar os fluxos completos da UI. `local:test:verify` valida schema, dados e
consultas REST autenticadas que alimentam o dashboard e o menu.

As fixtures estão em `supabase/local-fixtures/`: `malotes-core.sql` contém o
núcleo compartilhado, `app-core.sql` os cadastros e acesso, `app-operational.sql`
as telas principais, `app-secondary.sql` os módulos complementares e `seed.sql`
os cenários determinísticos. Ao adicionar uma nova tabela consumida pela UI,
inclua schema, pelo menos um registro sintético representativo e a checagem
correspondente em `scripts/verify-local-test-env.sh`.
