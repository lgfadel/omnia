# Baseline local completo para testes

## Objetivo

Disponibilizar um ambiente local isolado que permita desenvolver e depurar qualquer feature da UI atual sem depender de dados de produção. O ambiente deve executar a aplicação como produção (`next build` + `next start`), conter dados inteiramente sintéticos e detectar quando uma nova dependência de banco não estiver coberta.

## Limite de fidelidade

O repositório não possui uma migration-base ou dump do banco de produção. Assim, o baseline será uma réplica comportamental: a estrutura, relações, RLS, permissões e dados serão derivados dos contratos efetivamente usados pelos repositórios e serviços do Omnia. Ele não conterá nem solicitará dados reais.

## Arquitetura

- `supabase/local-fixtures/schema.sql`: cria, de forma idempotente, o schema público usado pela UI atual, incluindo usuários, permissões, menus, condomínios, atas, tarefas, admissões, rescisões, balancetes, CRM, notificações, anexos e tabelas de status.
- `supabase/local-fixtures/seed.sql`: insere um conjunto determinístico de dados relacionais. Inclui ADMIN, SECRETARIO e USUARIO, três condomínios, status de cada módulo, itens em aberto/concluídos/vencidos e anexos de exemplo.
- `supabase/local-fixtures/malotes-core.sql`: permanece como extensão específica de armazenamento e permissões do malote, integrada ao schema-base.
- `scripts/setup-local-test-env.sh`: sobe um Supabase com portas isoladas, aplica schema e seeds, cria o usuário local no Auth, grava apenas `apps/web-next/.env.local` e configura Mailpit para SMTP local.
- `scripts/verify-local-test-env.sh`: smoke test da base. Confirma autenticação, acesso às permissões/menus, consultas exigidas pelo Dashboard, Storage e o envio de um PDF para o Mailpit.

## Dados dummy

Os identificadores e valores são determinísticos para tornar bugs reproduzíveis. Os cenários mínimos cobrem:

- permissões: ADMIN com acesso completo e usuários com papéis distintos;
- Dashboard: atas, tarefas, admissões, rescisões e balancetes em estados aberto, atrasado e concluído;
- configurações: menus, status, tags, administradora e condomínios ativos/inativos;
- malotes: configuração global, anexos e tentativas de envio;
- dados operacionais: CRM, notificações e anexos necessários às telas atuais.

Nenhum e-mail, CPF, CNPJ, endereço ou documento real será usado. E-mails terminam em `.local` e documentos utilizam valores fictícios válidos apenas para desenvolvimento.

## Segurança e isolamento

- A pilha usa o projeto Docker `omnia-local-test`, portas `55420–55429` e volumes próprios.
- Não há ligação, importação ou escrita em Supabase compartilhado/produção.
- O `service_role` recebe as permissões SQL exigidas pelos serviços de servidor; o navegador utiliza apenas a chave anônima e as políticas RLS.
- SMTP aponta para Mailpit local. Nenhum e-mail é entregue externamente.

## Padrão de desenvolvimento

1. `npm run local:test:up` prepara o banco e os dados.
2. `npm run local:test:app` inicia o build de produção local.
3. `npm run local:test:verify` deve passar antes de considerar o ambiente pronto.
4. Uma feature que introduza nova tabela, coluna, relação, bucket ou política deve ampliar schema, seed e smoke test no mesmo commit.

O navegador normal, com extensões habilitadas, faz parte da validação manual. O layout tolera atributos adicionados por extensões no `body`, mas testes automatizados continuam verificando inconsistências internas do React.

## Critérios de aceite

- Dashboard carrega sem erro e exibe métricas sintéticas.
- A navegação não mostra erro de permissões.
- Todas as rotas atuais podem inicializar sem erro de tabela/coluna inexistente.
- Malotes envia PDF dummy e o Mailpit o recebe.
- O provisionamento pode ser repetido sem duplicar ou corromper dados.
- Testes unitários, build e smoke test local passam em modo de produção.
