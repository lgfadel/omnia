# Importação de transcrição pronta

Status: implementado e validado localmente, com suporte a TXT e VTT do Zoom.

## Objetivo

Permitir que uma ata receba sua transcrição por uma de duas origens: transcrever
uma gravação ou importar um arquivo de texto pronto. O texto importado fica
disponível no editor de revisão existente e serve de base para a minuta.

## Alternativas e decisão proposta

1. **Reaproveitar os registros de transcrição e identificar a origem.** Mantém
   revisão, permissões, histórico e geração de minuta no fluxo existente. Exige
   distinguir importação de áudio no painel e nos metadados. Recomendada.
2. **Criar um armazenamento independente para textos importados.** Evita ampliar
   os metadados atuais, mas duplica a escolha de transcrição vigente e obriga
   revisão e minuta a consultar duas fontes. Complexidade desnecessária.
3. **Importar como documento de apoio da minuta.** Reaproveita anexos, mas não
   satisfaz o requisito de usar o texto como a própria transcrição da assembleia.

## Experiência proposta

- Na aba Transcrição, oferecer as opções **Transcrever áudio** e **Importar
  transcrição**, com apenas uma opção selecionada por vez.
- A primeira opção preserva o envio e processamento de gravações existente.
- A importação aceita um arquivo `.txt` ou `.vtt`, até 5 MiB. O VTT do Zoom
  é convertido em texto com nomes e falas, removendo números dos blocos,
  timestamps e metadados de legenda.
- Exibir o nome do arquivo e uma explicação de que o texto será salvo e poderá
  ser usado na minuta. Não apresentar etapas de processamento de áudio para
  importações.
- O arquivo importado abre diretamente no editor existente. A origem aparece
  como **Transcrição importada**, com o nome do arquivo, sem player ou alertas
  de áudio ausente. Não marcar automaticamente como revisado.
- Preservar salvar rascunho, marcar como revisada, baixar `.txt` e preparar
  minuta. A revisão continua recomendada e não é um bloqueio adicional.
- Permitir substituir a transcrição por qualquer uma das duas origens. Quando
  já existir uma, confirmar a substituição com o usuário, seguindo o diálogo
  existente. Só ativar a nova fonte após ela ter sido salva com sucesso.
- Rejeitar uma nova importação ou transcrição enquanto houver upload,
  transcrição ou importação em andamento para a mesma ata.
- Preservar a convocação opcional como contexto para a minuta também na
  importação.
- Descartar retorna à seleção das duas opções. A minuta já existente mantém seu
  conteúdo; a próxima geração usa a transcrição vigente.

## Integração com o código atual

`AtaTranscriptionPanel.tsx` controla envio, revisão e substituição.
`AtaTranscriptionUpload.tsx` apresenta a seleção inicial;
`AtaTranscriptionReview.tsx` apresenta editor, áudio e ações. Esses pontos devem
representar as duas origens, com um componente pequeno para importação caso
necessário, sem replicar o editor.

`ataTranscriptionsRepo.supabase.ts` ganha uma operação de importação e mapeia a
origem do registro. A gravação do texto passa pelo servidor, com as mesmas
verificações de acesso de `supabase/functions/ata-transcriptions/index.ts`:
ADMIN, SECRETARIO ou responsável pela ata. O servidor valida nome, tamanho,
conteúdo e estado atual da ata; validação somente no navegador não é suficiente.

O modelo existente exige um registro de `omnia_ata_transcription_jobs` para cada
linha em `omnia_ata_transcriptions`. Uma migration adiciona a origem
`audio`/`text_import`, com `audio` como padrão para os registros existentes, e
permite ausência real dos metadados exclusivos de áudio nas importações.
Importações têm estado concluído e não entram na fila do worker. Não inventar
caminho de Storage, duração, modelo ou consumo de transcrição para um arquivo
que não foi transcrito.

A criação da importação, a gravação de `raw_text` e a troca da fonte vigente
devem ocorrer em uma transação. Em falha, preservar a transcrição anterior.
Manter o índice único de uma fonte atual por ata. Aplicar exclusão mútua no
servidor e tratar conflito concorrente sem sobrescrever silenciosamente uma
fonte recém-alterada. Qualquer função de banco auxiliar deve ficar restrita aos
papéis necessários e não ampliar as permissões atuais.

Revisar também as ações de áudio, exclusão de objetos e nova tentativa para que
não tratem textos importados como gravações. Preservar o funcionamento dos
registros históricos de áudio em Supabase Storage e R2.

`ataMinutaService.ts` já consulta o registro vigente e usa
`revised_text ?? raw_text`. Salvar a importação no mesmo modelo permite consumir
esse texto pelo fluxo existente, inclusive a referência à transcrição de origem
da minuta. Não chamar serviço de transcrição na importação.

## Validação de arquivo e erros

Aceitar um arquivo por vez, validar extensão `.txt`/`.vtt`, tamanho e conteúdo textual.
Aceitar UTF-8, com ou sem BOM, preservando acentos e parágrafos; normalizar apenas
as quebras de linha. Informar claramente quando a codificação não puder ser
lida. Rejeitar arquivos vazios, apenas com espaços, binários ou maiores que o
limite, sem alterar a fonte vigente. O servidor repete as validações relevantes
do texto recebido e calcula seu tamanho em bytes.

Falha de leitura ou gravação deve ter mensagem específica e permitir tentar
novamente. Impedir envios duplicados durante a leitura e a persistência.

## Critérios de aceitação e verificação

1. Uma ata vazia oferece as duas opções, mutuamente exclusivas.
2. Importar texto com acentos e múltiplos parágrafos salva e exibe o conteúdo;
   recarregar a página preserva o texto e a identificação de sua origem.
3. A importação não envia áudio, não acorda o worker e não busca URL de áudio.
4. Revisar e salvar o texto importado funciona; gerar minuta usa a revisão salva
   ou, na ausência dela, o texto importado original.
5. Substituição em ambos os sentidos respeita confirmação, exclusividade e
   rollback em falha. Cancelar mantém a transcrição vigente.
6. Arquivos inválidos, erros de acesso e concorrência não descartam o texto atual.
7. Usuários sem acesso à ata não conseguem importar ou ler sua transcrição.
8. Os testes existentes do fluxo de áudio continuam passando.

Na implementação: testes de validação, painel, repositório e servidor; teste de
integração da transação em banco local com dados fictícios; verificar a entrada
da geração de minuta com transcrição importada. Executar type-check, lint,
build e a suíte Vitest em modo não interativo (`npm run test:run`). A raiz
do projeto delega o build ao Next.js; não há bundle CommonJS `dist/` neste fluxo.

## Limites do escopo proposto

Não incluir OCR, PDF, Word, identificação automática de falantes ou retranscrição
do texto. Os nomes presentes no VTT são preservados. Publicação da aplicação e aplicação de migration em
ambiente compartilhado são etapas posteriores à implementação e validação.
