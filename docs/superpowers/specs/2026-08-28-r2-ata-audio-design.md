# Migração dos áudios de atas para Cloudflare R2 — Design

## Objetivo

Permitir o envio confiável de gravações de até 1 GiB para transcrição sem depender do limite global de upload do Supabase Free, mantendo os áudios privados.

## Decisão

Todos os novos áudios de transcrição serão gravados no bucket privado R2 `omnia-ata-audio`. A aplicação usará upload multipart direto do navegador, em partes uniformes de 20 MiB (a última pode ser menor), com até três tentativas por parte. Os áudios já existentes continuarão acessíveis no bucket Supabase.

O upload multipart é necessário para arquivos grandes: permite retomar uma parte que falhou, sem retransmitir um arquivo inteiro. O browser nunca recebe credenciais R2; ele recebe somente URLs pré-assinadas, restritas ao objeto, parte e prazo de uma hora.

## Modelo de dados e compatibilidade

Será acrescentada a coluna `storage_provider` em `omnia_ata_transcription_jobs`, limitada a `supabase` e `r2`, com valor padrão `supabase`. Os registros existentes não mudam. Novos jobs terão `storage_provider = 'r2'`; `storage_path` permanece a chave do objeto para preservar o modelo atual.

## Fluxo

1. O navegador pede `create` à Edge Function, com metadados já validados.
2. A função autoriza o usuário, cria o job R2, inicia o multipart no R2 e devolve o identificador, tamanho da parte e as URLs pré-assinadas de `UploadPart`.
3. O navegador envia as partes em paralelo limitado, lê o `ETag` exposto pelo CORS e informa todas as partes a `complete`.
4. A função conclui o multipart no R2, confirma a existência/tamanho do objeto, muda o job para `queued` e acorda o worker.
5. O worker baixa do R2 quando `storage_provider = 'r2'`; jobs legados continuam baixando do Supabase Storage.
6. Player, descarte e substituição chamam o provedor correto. URLs de reprodução R2 também são pré-assinadas e expiram após quatro horas.

## Segurança e operação

- Segredos `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID` e `R2_SECRET_ACCESS_KEY` ficam apenas na Edge Function e no worker Railway; nunca têm prefixo `NEXT_PUBLIC_`.
- A Edge Function continua sendo a única autoridade para criar, concluir, abortar, apagar e assinar objetos R2.
- CORS do bucket permitirá somente `https://omnia.loovus.com.br` e origens locais de desenvolvimento, com `PUT`, `GET` e `HEAD`, cabeçalho `Content-Type` e `ETag` exposto.
- Falhas de upload abortam o multipart e removem o job. Uploads incompletos também são removidos pelo ciclo de vida padrão do R2.
- O deploy exige configurar os quatro segredos no Supabase e no Railway; `.env.local` já contém os placeholders locais.

## Critérios de aceite

- Um arquivo M4A de 898 MB pode ser enviado e enfileirado sem passar pelo Supabase Storage.
- Falhar uma parte não reinicia as demais já concluídas.
- Um job histórico com `storage_provider = 'supabase'` continua reproduzível e processável.
- Credenciais R2 não aparecem no bundle web, em respostas HTTP ou em logs.
- O bucket permanece sem acesso público.

## Testes

- Testes unitários cobrirão o planejamento de partes, a coleta de ETags, a tentativa/retry e o abort em falha.
- Testes do repositório cobrirão o contrato de criação multipart e a chamada de conclusão.
- Testes do worker cobrirão a seleção entre download R2 e Supabase.
- Uma verificação autenticada contra o bucket confirma acesso sem listar credenciais; já retornou HTTP 200 em 28/08/2026.
