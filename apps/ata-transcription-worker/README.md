# Worker de transcrição de ATAs

Serviço Railway que processa em background os trabalhos em `omnia_ata_transcription_jobs`.

## Deploy

1. Crie um serviço Railway apontando para este diretório (`apps/ata-transcription-worker`).
2. O `Dockerfile` instala FFmpeg e inicia o polling automaticamente. Mantenha uma réplica; o lease de 45 minutos recupera trabalho abandonado após reinício.
3. Configure, somente no Railway, as variáveis `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `OPENAI_ATA_TRANSCRIPTION_API_KEY`.

Crie a última variável como uma chave de service account exclusiva do projeto OpenAI desta feature, com o escopo mínimo de requisição de modelo. O worker usa `gpt-4o-transcribe-diarize` com idioma `pt`, divide gravações em blocos de 20 minutos e remove o objeto privado do Storage após concluir. Em caso de falha, mantém o áudio para uma nova tentativa.
