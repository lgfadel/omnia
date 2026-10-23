# Importação de transcrição — plano de implementação

> Executar neste checkout, tarefa por tarefa, com testes antes de cada mudança.

**Objetivo:** importar `.txt` e `.vtt` do Zoom como alternativa exclusiva ao áudio.
**Arquitetura:** parser compartilhado por cliente/Edge Function; mesma transcrição
e revisão existentes; ativação atômica com comparação da fonte vigente.
**Tecnologias:** React, Next.js, Vitest, Supabase Edge Functions e PostgreSQL.

## Restrições

- `.txt` e `.vtt`, UTF-8, até 5 MiB; preservar nomes e falas do Zoom.
- Nenhum worker ou arquivo de áudio para importações; manter revisão opcional.
- Uma fonte atual por ata; preservar a anterior se a nova falhar.
- ADMIN, SECRETARIO ou responsável pela ata; RPC restrita a service_role.
- Artefatos de teste somente em `.context/`; não aplicar em banco compartilhado.

## 1. Leitura de texto e VTT

- [x] Criar `apps/web-next/src/lib/__tests__/ataTranscriptionImport.test.ts`.
  Exercitar texto com acentos, VTT do Zoom com números e nomes, `<v Nome>`,
  entidades, STYLE/NOTE/REGION, arquivo vazio, VTT inválido e limite de tamanho.
  Exemplo: `expect(parseTranscriptionText('zoom.vtt',
  'WEBVTT\n\n1\n00:00:00.000 --> 00:00:02.000\nMaria: Olá.')).toBe('Maria: Olá.')`.
- [x] Executar `npm run test -- --run ataTranscriptionImport` e observar falha.
- [x] Criar `supabase/functions/ata-transcriptions/importText.ts`, sem dependências
  de DOM, e reexportar em `apps/web-next/src/lib/ataTranscriptionImport.ts`.
  Interfaces: `parseTranscriptionText(name, content): string`,
  `validateTranscriptionFile(name, size): void`, `readTranscriptionFile(file): Promise<string>`.
- [x] Reexecutar os testes e confirmar sucesso.

## 2. Persistência e exclusividade

- [x] Criar teste de banco transacional em `.context/`: importação atual,
  substituição, rollback, job em curso, referência obsoleta e permissões da RPC.
- [x] Migration: `source_type` (`audio`/`text_import`, padrão `audio`), metadados
  exclusivos de áudio anuláveis e restrições por origem.
- [x] RPC `omnia_activate_ata_transcription(p_job_id uuid,
  p_expected_job_id uuid, p_raw_text text)` com `security invoker`, acesso apenas
  por service_role: bloquear a ata, conferir fonte esperada e estado inativo,
  gravar texto importado e trocar fonte atual na mesma transação. Retornar
  metadados da fonte anterior para limpeza de áudio.
- [x] Edge Function: ação `import`, validação com parser real, criação de registro
  inativo e chamada da RPC; reutilizar a RPC na ativação de áudio. Limpar registro
  inativo em erro. Não assinar ou excluir objetos de uma importação.
- [x] Repositório: `importText(ataId, fileName, content, expectedJobId, contextText)`;
  acrescentar fonte esperada ao envio de áudio e mapear `sourceType`.
- [x] Executar testes HTTP da Edge Function com cliente Supabase real e transporte
  externo simulado; executar SQL contra banco isolado e verificar resultados.

## 3. Interface e integração da minuta

- [x] Acrescentar testes do painel para escolha exclusiva, importação e revisão,
  erros, seleção repetida, substituição confirmada e cancelada, e ausência de
  chamada de áudio para importações. Executar e observar falhas.
- [x] Reaproveitar `AtaTranscriptionUpload.tsx` para selecionar `.txt`/`.vtt`,
  compartilhando o dropzone e a convocação com a opção de áudio. Usar grupos de
  botões acessíveis para as duas fontes e indicar estado de leitura/importação.
- [x] Adaptar `AtaTranscriptionPanel.tsx` e `AtaTranscriptionReview.tsx`:
  substituição discriminada por origem, nome do arquivo importado, progresso sem
  áudio, mesma revisão e botão de minuta; conservar convocação opcional.
- [x] Testar o serviço de minuta com o texto de importação e revisão persistida.
- [x] Reexecutar os testes de painel, upload, repositório e minuta.

## 4. Verificação e entrega

- [x] Executar `npm run type-check`, `npm run lint`, `npm run build` e
  `npm run test:run`; executar testes do worker se alterações o afetarem.
- [x] Verificar migration e RPC em PostgreSQL local com dados fictícios.
- [x] Inspecionar interface em navegador se o ambiente local estiver disponível.
- [x] Rever diff, validar permissões/concorrência e documentar uso no README.
- [x] Entregar alterações locais e informar claramente as etapas de publicação.
