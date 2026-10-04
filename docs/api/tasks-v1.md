# API oficial de tarefas v1

O contrato de máquina está em [OpenAPI 3.1](./tasks-v1.openapi.json). Esta API é servida pelo aplicativo Next.js em `/api/v1`; as rotas MCP ficam em outro serviço. A implementação local foi verificada, mas a migração e os serviços ainda dependem da sequência de implantação em [Integração com Grok Bot](../integrations/grok-bot-tasks.md).

## Identidade e autorização

Envie `Authorization: Bearer <valor>` em toda chamada. Um JWT de sessão do navegador é validado pelo Supabase Auth e resolve o usuário Omnia existente. Uma chave pessoal `omnia_api_…` chama recursos diretamente. Uma chave `omnia_mcp_…` só entra no gateway MCP; ela não chama recursos da API. O gateway usa seu segredo de serviço separado para trocar essa chave em `POST /api/v1/mcp/exchange` por uma capacidade `omnia_cap_…`, válida por até 15 minutos e nunca além da chave mãe. A capacidade é aceita apenas nos recursos e é mantida na memória durante a requisição MCP. Chaves de API e capacidades não podem ser trocadas novamente.

O usuário verificado continua sendo o autor da ação. A permissão atual de `/tarefas`, estado ativo, escopos `tasks:read`, `tasks:create` e `tasks:update`, visibilidade por RLS, validade da chave e revogação da chave mãe são reavaliados em cada operação. `mine=true` filtra tarefas atribuídas ao próprio usuário; não amplia visibilidade. Tarefa privada fica visível para seu criador e para `ADMIN`, respeitando uma negação explícita de permissão do usuário. Qualquer usuário autenticado ativo pode gerenciar as próprias chaves, mesmo sem acesso ao menu de tarefas; esse acesso não lhe dá permissão de usar os recursos.

As chaves são criadas em **Minhas integrações** (`/integracoes`) ou por `POST /api/v1/integration-keys` com JWT de navegador. Escolha `audience: "api"` ou `"mcp"`, nome e um subconjunto não vazio dos três escopos. A resposta de criação traz o `token` uma única vez; a listagem e a revogação só retornam metadados. A validade padrão é 90 dias; um `expiresAt` explícito precisa ser futuro e no máximo 365 dias adiante. `DELETE /api/v1/integration-keys/{id}` revoga apenas uma chave do próprio usuário. Na interface, a substituição cria a nova chave antes de revogar a antiga e mostra uma falha de revogação para tratamento manual.

## Rotas e representação

| Rota | Escopo/identidade | Resultado |
| --- | --- | --- |
| `GET /api/v1/tasks` | leitura | `{items, nextCursor}` |
| `POST /api/v1/tasks` | criação | tarefa, `201`, `ETag` |
| `GET /api/v1/tasks/{id}` | leitura | tarefa, `ETag` |
| `PATCH /api/v1/tasks/{id}` | atualização | tarefa, `ETag` |
| `GET /api/v1/task-statuses` | leitura | status com `isDefault` e `isFinal` |
| `GET /api/v1/task-assignees` | leitura | usuários ativos e elegíveis |
| `GET /api/v1/integration-keys` | somente JWT de navegador | metadados das próprias chaves |
| `POST /api/v1/integration-keys` | somente JWT de navegador | metadados e segredo de uso único |
| `DELETE /api/v1/integration-keys/{id}` | somente JWT de navegador | metadados revogados |
| `POST /api/v1/mcp/exchange` | somente segredo de serviço do backend | capacidade e token de uso único |

A tarefa retorna `id` (UUID interno), `ticketId` (número público sequencial gerado pelo sistema) e `ticketOcta` (referência externa opcional). Nunca envie `ticketId` para criar ou alterar uma tarefa. Campos aceitos em criação e alteração: `title`, `description`, `priority` (`URGENTE`, `ALTA`, `NORMAL`, `BAIXA`), `dueDate`, `ticketOcta`, `statusId`, `assignedToId`, `tags`, `isPrivate`, `oportunidadeId` e, **somente para o navegador**, `recurrence`. `title` é obrigatório na criação; PATCH exige ao menos um campo. Campos desconhecidos, IDs de autor, números gerados, contadores e estado derivado de recorrência são rejeitados. `description`, `dueDate`, `ticketOcta`, `assignedToId` e `oportunidadeId` aceitam `null` para limpar o valor. Datas de vencimento e recorrência usam `YYYY-MM-DD`; `createdAt` e `updatedAt` são instantes com deslocamento de fuso. Preserve `updatedAt` e o `ETag` exatamente como recebidos, inclusive microssegundos.

As respostas de tarefa incluem status/usuário por ID, referências `assignedTo` e `createdBy` (possivelmente `null`), contagens de comentários/anexos, privacidade e metadados de recorrência. Os campos legados `createdById` e `recurrence.templateTicketId` podem ser `null`. `GET /api/v1/task-statuses` é a fonte de status e de `isFinal`; não suponha IDs ou nomes fixos. A integração pode concluir uma ocorrência recorrente já existente por atualização, mas não pode enviar o campo `recurrence`, nem mesmo `null`. Usuários do navegador podem configurar frequência diária/semanal/mensal, intervalo de 1 a 365, início e término; `recurrence:null` em PATCH interrompe uma série humana sem apagar o histórico. A conclusão gera no máximo a próxima ocorrência da própria série, de forma transacional e deduplicada.

Na criação humana com `recurrence` não nula, o `dueDate` da primeira ocorrência recebe `recurrence.startDate`, mesmo que outro vencimento tenha sido enviado. Por exemplo, `dueDate:"2026-12-01"` com `recurrence.startDate:"2026-10-04"` cria a primeira ocorrência em 4 de outubro. A criação avulsa conserva o vencimento informado; edições posteriores podem alterar o vencimento de cada ocorrência de forma independente, e mudanças de frequência ou início preservam a próxima data pendente da série enquanto permitida pelos limites. Se não houver outra ocorrência permitida pelos limites, a série já retorna `isActive:false` e `nextOccurrenceDate:null`; uma série diária `ON_DATE` cujo início e fim sejam 4 de outubro contém apenas essa primeira ocorrência.

`title` de tarefa e `name` de chave têm os espaços nas extremidades removidos antes da validação. O resultado vazio é rejeitado; depois se aplicam os limites de 500 e 100 caracteres, respectivamente.

`GET /api/v1/tasks` usa `limit` de 1 a 100 (padrão 50) e ordenação decrescente `(createdAt,id)`. Passe `nextCursor` sem modificá-lo no parâmetro `cursor` da página seguinte; ele é opaco. Filtros opcionais: `query`, `statusId`, `assignedToId`, `mine=true|false`, `priority`, `isPrivate=true|false`, `oportunidadeId`, `tags` (array JSON codificado como um valor de query), `dueDateFrom` e `dueDateTo` inclusivos. `query` procura título, descrição, `ticketOcta` ou o `ticketId` numérico exato. `tags` exige todas as tags fornecidas. Chaves de query duplicadas ou desconhecidas falham com 400. A busca de responsáveis aceita `query` e `limit` 1–100, padrão 50; o cliente deve pesquisar no servidor para alcançar usuários além da primeira página.

POST/PATCH de tarefas exigem `Idempotency-Key` escolhido pelo cliente: 1–200 caracteres ASCII imprimíveis, sem vírgula. Uma repetição com a mesma chave e payload pelo mesmo principal/operação retorna a resposta original, sem nova mutação ou auditoria. Repetir a chave com payload diferente retorna `409 IDEMPOTENCY_CONFLICT`. A repetição ainda verifica chave, usuário, permissões, escopos e visibilidade atuais. Uma sessão MCP nova compartilha o principal da chave mãe para essa finalidade. PATCH também exige o `If-Match` forte do `ETag` de GET/POST/PATCH; ausência retorna `428 PRECONDITION_REQUIRED`, versão antiga retorna `412 PRECONDITION_FAILED`. Após 412, leia a tarefa novamente antes de decidir uma nova alteração; não reenvie o patch de forma incondicional.

Exemplo com variáveis locais de ambiente e valores fornecidos pelo operador, sem colocar segredo no arquivo ou URL:

```sh
curl --fail-with-body --get "$OMNIA_API_URL/api/v1/tasks" \
  --header "Authorization: Bearer $OMNIA_API_TOKEN" \
  --data-urlencode 'limit=20' \
  --data-urlencode 'mine=true'
```

As respostas processadas pela API trazem `Cache-Control: no-store`, `X-Request-Id` e JSON `{data,requestId}` ou `{error:{code,message},requestId}`. `X-Request-Id` de entrada é preservado apenas se for UUID válido. Erros tipados incluem 400 (validação), 401 (bearer/chave), 403 (ator/audience/escopo/permissão), 404 (ausente ou invisível), 409 (conflito), 412, 428 e 429 (`Retry-After: 60`). O corpo JSON de escrita é limitado a 64 KiB; excesso retorna 413, Content-Type incompatível 415, falha interna saneada 500, integração desativada 503. O orçamento persistente é de 120 requisições de recurso/troca por usuário por minuto; tentativas de usuários verificados e autorizados também consomem esse orçamento quando retornam erros de domínio, como 404, conflito de idempotência ou versão antiga. Gestão de chaves fica fora dele. A camada Next.js pode responder a um **verbo de rota não implementado** com seu 405 padrão sem esse envelope ou `X-Request-Id`; o contrato de envelope aplica-se aos handlers implementados.

`OMNIA_INTEGRATIONS_READ_ENABLED` e `OMNIA_INTEGRATIONS_WRITE_ENABLED` aceitam somente o texto literal `true` e começam desligados. GET de integração precisa do primeiro; POST/PATCH do segundo. Chamadas com JWT de navegador seguem independentes. A troca MCP só fica habilitada se ao menos um dos dois estiver ligado, mas cada recurso ainda exige sua própria chave de habilitação.
