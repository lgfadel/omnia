# Notificações Web Push

As notificações criadas em `omnia_notifications` enfileiram um envio para cada dispositivo inscrito e acionam o processamento após o commit. O cron atua como recuperação de falhas e de itens pendentes. O navegador deve ter HTTPS; no iOS/iPadOS 16.4 ou posterior, instale o Omnia pela opção **Compartilhar → Adicionar à Tela de Início** antes de ativar o push. O texto identifica o evento, o número e título da tarefa ou o título da ata. Menções e atribuições incluem o autor quando disponível. Títulos de tarefas só entram no envio quando o destinatário atende às restrições de acesso. O conteúdo integral permanece sujeito às permissões do Omnia.

## Configuração por ambiente

1. Aplique a migration `web_push_notifications` ao projeto Supabase do ambiente.
2. Gere um par VAPID, por exemplo com `npx web-push generate-vapid-keys`. Configure `NEXT_PUBLIC_VAPID_PUBLIC_KEY` no build do Next.js. Configure na Edge Function `VAPID_PUBLIC_KEY` com o mesmo valor, `VAPID_PRIVATE_KEY` com a chave privada, `VAPID_SUBJECT` com um endereço `mailto:` válido ou a URL HTTPS do aplicativo e `PUSH_WORKER_SECRET` com um segredo aleatório longo. Nunca exponha a chave privada ou o segredo ao navegador. O runtime Supabase fornece `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`.
3. Publique `send-web-push` no Supabase do ambiente. Ela aceita somente POST com o cabeçalho `x-push-worker-secret`; a verificação JWT está desativada porque a própria função verifica esse segredo. Não use chaves públicas como segredo.
4. As migrations habilitam `pg_net` e agendam a recuperação com `pg_cron`. Coloque no Vault os segredos `push_project_url` (URL do projeto Supabase) e `push_worker_secret` (o mesmo segredo da função). A migration já configura o agendamento; o comando equivalente é:

```sql
select cron.schedule('omnia-web-push-recovery', '* * * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'push_project_url') || '/functions/v1/send-web-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-worker-secret',
      (select decrypted_secret from vault.decrypted_secrets where name = 'push_worker_secret')),
    body := '{}'::jsonb, timeout_milliseconds := 150000
  );
$$);
```

O segredo aparece temporariamente na fila interna do `pg_net`: restrinja acesso ao banco e siga as recomendações do Supabase para [agendamento de Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions). Cada chamada processa até 10 inscrições; os jobs restantes aguardam chamadas posteriores. Envios são pelo menos uma vez: uma falha após o provedor aceitar pode ocasionar repetição.

## Novos comentários

Novos comentários em tarefas notificam o criador e o responsável; em atas, notificam o criador, o responsável e o secretário. Quem comentou não recebe o próprio aviso. Usuários inativos e usuários sem acesso à tarefa são excluídos. Se uma pessoa também for mencionada, recebe apenas a notificação de menção. Os eventos são criados no banco, incluindo comentários enviados pela API, e aparecem na interface e no push dos dispositivos inscritos. Edições de comentários e mudanças de status não criam esses avisos.

Valide as regras em um PostgreSQL descartável, com dados fictícios, usando `bash scripts/test-comment-notifications.sh` (requer Docker). O teste não acessa nenhum projeto Supabase.

## Operação

Consulte `omnia_push_jobs` com uma conexão administrativa para medir o tamanho da fila, idade dos itens e `last_error`; a função registra quantidade processada e falhas sem registrar endpoints ou conteúdo. Falhas transitórias repetem com intervalo crescente até uma hora; HTTP 404/410 remove a inscrição. Monitore também os logs da função e do cron. Desativar push ou sair remove a inscrição do dispositivo; a permissão do sistema pode ser alterada nas configurações do navegador ou celular.

Para trocar as chaves VAPID, peça que os usuários desativem e ativem novamente o push nos dispositivos após publicar a nova chave pública. Teste em um Android e um iPhone reais, com o Omnia aberto e fechado, antes de habilitar em produção.
