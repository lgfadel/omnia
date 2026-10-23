# Verificação — importação de transcrição

Registro da validação local em 23/10/2026, anterior à publicação autorizada depois pelo usuário. Alterações na branch `feat/atas-import-transcription`.

## Fluxo implementado

Aba Transcrição → escolha entre áudio e importação → leitura de TXT/VTT UTF-8 →
Edge Function autenticada → ativação transacional no PostgreSQL → revisão no
editor existente → geração da minuta com o texto original ou a revisão salva.

- TXT e VTT, até 5 MiB, um arquivo por vez.
- VTT do Zoom preserva nomes e falas, removendo timestamps e metadados.
- Importações não entram no worker nem consultam áudio.
- Uma transcrição vigente por ata; substituição confirmada na interface e
  protegida contra fonte desatualizada no servidor.
- Upload cancelado restaura o predecessor exato; conclusão e cancelamento
  concorrentes não excluem a gravação da operação vencedora.

## Evidências

| Verificação | Resultado |
|---|---|
| `npm run test:run` | 78 arquivos, 743 testes passaram |
| `npm run type-check` | passou |
| `npm run build` | compilou com sucesso |
| `npm run lint` | 0 erros, 83 avisos preexistentes em outros arquivos |
| `deno check --no-lock supabase/functions/ata-transcriptions/index.ts` | passou |
| Deno lint dos dois arquivos da função | passou, excluindo apenas `no-import-prefix`, pois o import HTTPS já existia |
| Migration em PostgreSQL 17 isolado | aplicada do zero, com migrations anteriores de transcrição |
| Testes transacionais de banco | texto, histórico, exclusividade, fonte obsoleta, rollback em erro, cancelamento com/sem predecessor e RLS passaram |
| Revisão independente de código | achados corrigidos; última revisão sem P1/P2 restante |
| Navegador Chrome, 1380 e 390 pixels | importação VTT, revisão, recarga, navegação para minuta e descarte passaram; nenhum erro JavaScript ou overflow horizontal |

Os testes HTTP usam o cliente Supabase real, substituindo somente o transporte
externo. Os testes do serviço de minuta verificam a entrada enviada ao provedor
com a importação original e uma revisão persistida. A inspeção visual usa os
componentes reais com um repositório local de demonstração; não representa um
teste integrado contra serviços publicados.

Os testes SQL usam somente um container temporário e dados fictícios. Fixtures
em `.context/transcription-import-bootstrap.sql` e
`.context/transcription-import-db-test.sql`; capturas e harness visual em
`.context/transcription-import-preview/`. Nenhum banco compartilhado foi alterado.

## Publicação

Situação no encerramento da validação local: ainda não publicado. Aplicar
`supabase/migrations/20261023155020_add_ata_transcription_import.sql` antes de
publicar a Edge Function `ata-transcriptions` e o frontend juntos. A função passa
a depender das RPCs e dos novos metadados. O worker mantém o fluxo atual: apenas
jobs de áudio podem ficar na fila, pela restrição de origem do banco.

O novo frontend envia a referência da transcrição substituída também no áudio.
Uma tela antiga sem essa referência recebe conflito ao substituir uma fonte já
existente e deve ser recarregada; isso impede uma substituição silenciosa.
