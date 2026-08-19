# Worker de transcrição de ATAs

Serviço Railway que processa em background os trabalhos em `omnia_ata_transcription_jobs`.

## Deploy

1. Crie um serviço Railway apontando para este diretório (`apps/ata-transcription-worker`).
2. O `Dockerfile` instala FFmpeg e inicia o polling automaticamente. Mantenha uma réplica; o lease de 45 minutos recupera trabalho abandonado após reinício.
3. Configure, somente no Railway, as variáveis `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `OPENAI_ATA_TRANSCRIPTION_API_KEY`.

### Estado provisionado

Projeto Railway `omnia-ata-transcription` (`d633647d-5482-4989-977b-8cbca401d861`),
serviço `ata-transcription-worker` (`0fc34cb9-da24-4294-a0e5-ee7243abe221`),
ambiente `production`, com as três variáveis já configuradas.

> **Pendência de CD.** O primeiro deploy foi feito com `railway up` a partir dos
> arquivos locais, não do GitHub. O código em execução não está amarrado a nenhum
> commit, então um `git push` não redeploya nada. Antes de tratar isso como
> produção de verdade, conecte o repositório ao serviço e aponte o root directory
> para `apps/ata-transcription-worker`.

O worker não emite log em operação normal: ele consulta a fila a cada 5 s e só
escreve em caso de erro. Um serviço silencioso é um serviço saudável.

Crie a última variável como uma chave de service account exclusiva do projeto OpenAI desta feature, com o escopo mínimo de requisição de modelo. O worker usa `whisper-1` com idioma `pt`, divide gravações em blocos de 30 minutos e remove o objeto privado do Storage após concluir. Em caso de falha, mantém o áudio para uma nova tentativa.

## Por que whisper-1 e não o modelo com diarização

Teste controlado em 19/08/2026, mesmo arquivo e mesmos bytes, variando apenas o modelo:

| Modelo | Trechos em inglês | Resultado |
|---|---|---|
| `gpt-4o-transcribe-diarize` | 6,3% | Frases inventadas, como "The board is flat" repetido quatro vezes |
| `whisper-1` | 0% | Português coerente, 9x mais rápido, mesmo preço |

O `whisper-1` não separa falantes — era o único motivo de usar o outro modelo. Os nomes passam a ser atribuídos por quem revisa a ata. O áudio recebe `highpass`, `loudnorm` e compressão antes do envio, o que rendeu ~19% mais conteúdo transcrito em gravação de campo distante.
