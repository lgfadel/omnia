# Minuta de ATA — geração e refinamento conversacional

## Context

O passo 1 (transcrição) está pronto: o áudio vira texto revisável em
[AtaTranscriptionPanel.tsx](apps/web-next/src/components/atas/AtaTranscriptionPanel.tsx),
e a convocação em PDF já é lida no browser para ancorar nomes próprios
([convocacao.ts](apps/web-next/src/lib/convocacao.ts)). O botão **"Gerar minuta de ATA"**
existe na tela e hoje só mostra um aviso de "em breve".

O passo 2 é o que hoje acontece fora do Omnia: exportar o `.txt`, subir no ChatGPT junto
com a convocação e os PDFs de apuração de votação, receber a ata dividida por item de
pauta, e ir pedindo correções em conversa até o texto ficar bom. Esse ciclo inteiro passa
para dentro do produto — com o resultado versionado, editável à mão e refinável por chat.

Decisões já tomadas com o Owner:

| Decisão | Escolha |
|---|---|
| Refinamento | Chat multi-turno ao lado do texto; cada turno grava uma nova versão |
| Destino | Tabela própria + aba "Minuta" na ata + download `.docx` / `.txt` |
| Modelo | OpenAI, **`sol` por padrão, configurável em Configurações → Atas** |
| Documentos | PDF nativo para o modelo, guardados em bucket privado |
| Execução | Streaming direto do Next, com persistência incremental |
| Formato | Título por item de pauta + 3–4 parágrafos, sem bullets (markdown leve) |

Este arquivo é a spec. Na implementação ele é copiado para
`docs/superpowers/specs/2026-08-20-minuta-de-ata-design.md` e commitado antes do primeiro
código, seguindo o fluxo da casa.

---

## Arquitetura

```
Configurações → Atas (ADMIN)         Tela da ata → aba "Minuta"
   modelo, esforço, prompt                │
        │                                 ├── Documentos de apoio (PDFs)  → bucket privado
        ▼                                 ├── Editor (markdown leve) ─ manual → RLS direto
 omnia_ata_minuta_settings                └── Chat ──┐
        │                                            ▼
        └──────────────────────► POST /api/atas/[ataId]/minuta  (stream, nodejs)
                                             │
                    transcrição + PDFs em base64 + histórico do chat
                                             ▼
                              OpenAI Responses API (stream: true)
                                             │
                       deltas ──► cliente (texto aparecendo)
                              └─► flush a cada ~2 s no banco (content parcial)
                                             ▼
                        versão + mensagem do assistente ao concluir
```

**Por que streaming e não job no worker:** a espera fica legível — o texto aparece
enquanto o modelo escreve, que é exatamente a experiência do ChatGPT que estamos
substituindo. O preço é o teto de duração da função; o antídoto é a persistência
incremental: o que já saiu está no banco, então nem queda de conexão nem fechar a aba
perdem trabalho.

---

## Banco — uma migration nova

`supabase/migrations/2026XXXXXXXXXX_create_ata_minutas.sql`. As policies de RLS repetem
literalmente o predicado de time já usado em
[20260819143618_create_ata_audio_transcriptions.sql](supabase/migrations/20260819143618_create_ata_audio_transcriptions.sql)
(`ADMIN`/`SECRETARIO` ou `ata.responsible_id`), e os triggers reusam
`public.update_updated_at_column()`.

**`omnia_ata_minuta_settings`** — singleton, no idioma de `omnia_malote_settings`:
- `model text not null default 'sol'`
- `reasoning_effort text not null default 'high' check (in ('low','medium','high'))`
- `system_prompt text not null default <prompt do Owner, ver abaixo>`
- `updated_by`, timestamps. Linha semeada na própria migration.
- Leitura: qualquer membro do time. Escrita: `ADMIN`.

**`omnia_ata_minutas`** — a minuta atual de cada ata:
- `ata_id`, `transcription_id` (de qual transcrição nasceu), `created_by`
- `content text not null default ''` — markdown leve
- `status text check (in ('generating','ready','failed'))`, `error_message text`
- `model text`, `usage jsonb not null default '{}'`
- `is_current boolean not null default true` + índice único parcial por `ata_id`
  (mesmo idioma de `omnia_ata_transcription_jobs`)

**`omnia_ata_minuta_versions`** — histórico:
- `minuta_id`, `sequence int`, `content text`,
  `origin text check (in ('generation','chat','manual'))`, `created_by`, `created_at`
- `unique (minuta_id, sequence)`

**`omnia_ata_minuta_messages`** — o chat:
- `minuta_id`, `sequence int`, `role text check (in ('user','assistant'))`,
  `content text`, `version_id uuid null`, `created_by`, `created_at`

**`omnia_ata_minuta_documents`** — PDFs de apoio, presos à **ata**, não à minuta, para
sobreviverem a uma regeração:
- `ata_id`, `kind text check (in ('convocacao','apuracao','outro'))`, `storage_path`,
  `original_filename`, `size_bytes`, `created_by`, `created_at`

**Bucket** `ata-minuta-documents`: privado, `application/pdf`, 25 MB por arquivo, criado
com o mesmo `INSERT INTO storage.buckets ... ON CONFLICT DO UPDATE` das outras migrations.

**Menu:** duas linhas em `omnia_menu_items` + `omnia_role_permissions` para
`/config/atas` (só `ADMIN`), copiando o bloco de
[20260820150724_create_malotes_digitais.sql:97-118](supabase/migrations/20260820150724_create_malotes_digitais.sql#L97-L118).
O menu é dirigido por banco — sem essa linha a página existe mas não aparece.

---

## Servidor

**`apps/web-next/src/server/ataMinutaService.ts`** (novo). Reusa `authenticateOmniaUser`
já exportado por
[balanceteProtocolImportService.ts:99](apps/web-next/src/server/balanceteProtocolImportService.ts#L99)
e o mesmo padrão de client admin/anon/user.

- `assertMinutaAccess(user, ataId)` — mesmo predicado da RLS, aplicado no servidor porque
  a rota usa service role.
- `buildMinutaInput({ settings, ata, transcription, documents, messages, currentContent, instruction })`
  monta o `input` do Responses API:
  - mensagem `developer` com `settings.system_prompt`;
  - `input_text` com título da ata, condomínio, data da assembleia e a transcrição
    (`revised_text ?? raw_text`);
  - um `input_file` por PDF (`data:application/pdf;base64,…`), exatamente como
    [balanceteProtocolImportService.ts:236-259](apps/web-next/src/server/balanceteProtocolImportService.ts#L236-L259);
  - o `context_text` da convocação já salvo no job de transcrição entra como texto, mesmo
    quando não há PDF anexado — ele já está lá e é grátis;
  - em turno de chat: a minuta atual **inteira** + o histórico de instruções + a nova
    instrução. A minuta atual vem do banco, não do modelo, então uma edição manual feita
    entre dois turnos é respeitada.
- `streamMinuta()` — `POST https://api.openai.com/v1/responses` com `stream: true` e
  `reasoning: { effort }`; lê o SSE, reemite os deltas de texto para o cliente e faz flush
  do acumulado a cada ~2 s ou ~2000 caracteres em `omnia_ata_minutas.content`.
  Ao concluir: `status = 'ready'`, grava `omnia_ata_minuta_versions` e a mensagem
  `assistant`, e registra `usage`.
- `getMinutaSettings` / `updateMinutaSettings` — no idioma de
  [maloteService.ts:80-101](apps/web-next/src/server/maloteService.ts#L80-L101), com
  `assertAdmin` na escrita.
- `verifyMinutaModel(modelId)` — `GET /v1/models/{id}` na OpenAI. Serve ao botão "Testar
  modelo" da tela de configuração: um id errado é descoberto ali, e não no meio de uma
  geração de cinco minutos.

**Rotas:**
- `app/api/atas/[ataId]/minuta/route.ts` — `POST` (`{ instruction?: string }`; sem
  instrução = geração inicial). `runtime = 'nodejs'`, `maxDuration = 800`. Devolve
  `ReadableStream` de texto.
- `app/api/atas/[ataId]/minuta/documents/route.ts` — `POST` devolve URL assinada de
  upload; `DELETE` remove documento e objeto.
- `app/api/atas/minuta-settings/route.ts` — `GET`/`PUT`, e `POST` para o teste de modelo.

**Interrupção:** o flush move `updated_at`. Uma minuta em `generating` sem escrita há mais
de 90 s é tratada pela tela como interrompida — mesmo raciocínio do lease do worker de
transcrição. A tela mostra o texto parcial e oferece "Continuar" (novo turno partindo do
que existe) ou "Gerar de novo".

---

## Cliente

**Repositório** `apps/web-next/src/repositories/ataMinutasRepo.supabase.ts` — leituras
diretas via RLS (minuta, versões, mensagens, documentos) e o salvamento manual do texto,
seguindo `ataTranscriptionsRepo.supabase.ts`. Importante: o `update` do texto manual
precisa de `.select('id').maybeSingle()` e erro explícito quando não volta linha — a
mesma armadilha já documentada em
[ataTranscriptionsRepo.supabase.ts:172-186](apps/web-next/src/repositories/ataTranscriptionsRepo.supabase.ts#L172-L186).
Geração e upload passam pelas rotas.

**Componentes** em `apps/web-next/src/components/atas/`:
- `AtaMinutaPanel.tsx` — orquestra estado, streaming e erros.
- `AtaMinutaChat.tsx` — lista de mensagens e campo de instrução. A bolha do assistente
  **não** é texto do modelo: é derivada do diff real ("Versão 4 — 2 seções alteradas"),
  computado localmente. Um resumo pedido ao modelo poderia mentir sobre o que mudou; um
  diff, não.
- `AtaMinutaDocuments.tsx` — anexar/remover PDFs de apoio, com rótulo do tipo.
- `AtaMinutaVersions.tsx` — histórico com restauração de versão.
- Editor: reusar [AtaTranscriptionEditor.tsx](apps/web-next/src/components/atas/AtaTranscriptionEditor.tsx)
  (localizar/substituir é valioso numa ata) parametrizando `aria-label` e a classe de
  fonte, com um toggle **Editar / Visualizar**; o modo visualizar renderiza as seções
  formatadas.

**Libs** em `apps/web-next/src/lib/`:
- `ataMinuta.ts` — `parseMinutaSections()` (título + parágrafos), `diffSections()` para a
  bolha do chat, validação de PDF de apoio.
- `ataMinutaDocx.ts` — exportação `.docx` com títulos de verdade, usando a dependência
  nova `docx` (JS puro, roda no browser). `.txt` sai como já sai a transcrição.

**Tela:** nova aba `Minuta` entre `Transcrição` e `Anexos` em
[atas/[id]/page.tsx:196-207](apps/web-next/src/app/atas/[id]/page.tsx#L196-L207).
O botão "Gerar minuta de ATA" do painel de transcrição
([AtaTranscriptionPanel.tsx:399](apps/web-next/src/components/atas/AtaTranscriptionPanel.tsx#L399))
deixa de mostrar aviso e passa a navegar para a aba, disparando a geração. Transcrição não
revisada **não** bloqueia: gera com aviso na tela, como a copy atual já promete.

**Configuração:** `app/config/atas/page.tsx`, protegida por `RoleProtectedRoute
allowedRoles={['ADMIN']}`, no molde de
[config/malotes/page.tsx](apps/web-next/src/app/config/malotes/page.tsx): id do modelo
(com "Testar modelo"), esforço de raciocínio e o prompt do secretário em textarea.

---

## Prompt semeado

O prompt do Owner, adaptado para o contexto chegar como anexo e para a saída ser
estruturada:

> Você é o secretário de uma assembleia de condomínio. A partir da transcrição fornecida,
> escreva a ata da assembleia. Divida a ata de acordo com os assuntos da pauta listada na
> convocação anexa. Cada seção começa com um título curto do item de pauta, precedido de
> `## `, seguido de 3 a 4 parágrafos. Não use bullet points. Escreva na mesma língua da
> transcrição. Não deixe de fora nenhuma informação importante e não invente nada:
> atenha-se às informações dos arquivos anexos. Quando houver PDF de apuração de votação,
> use os números exatos dele. Resuma apenas os itens da pauta, sem cabeçalho e sem rodapé.

O `## ` é a única mudança de conteúdo, e existe para que o chat consiga mirar uma seção e
o `.docx` sair com hierarquia. Como o prompt vive no banco, o Owner ajusta sem deploy.

---

## Ordem de construção (TDD)

1. Migration + tipos em `data/types.ts`.
2. `lib/ataMinuta.ts` com testes (`parseMinutaSections`, `diffSections`, validação).
3. `server/ataMinutaService.ts` com testes: montagem do input (PDF vira `input_file`;
   turno de chat carrega a minuta atual do banco, não a do modelo), parse do SSE, flush
   incremental, negação de acesso fora do time.
4. Rotas + settings + `/config/atas`.
5. `AtaMinutaPanel` e filhos, com testes no idioma de
   `components/atas/__tests__/`.
6. Exportação `.docx` / `.txt`.
7. Ligar o botão da aba Transcrição e adicionar a aba Minuta.

## Verificação

- `npm run type-check`, `npm run lint`, `npm run test` — verdes.
- Local: `npm run local:test:up`, aplicar a migration, `npm run local:test:app`.
- Ponta a ponta numa ata real com transcrição pronta: anexar um PDF de apuração, gerar,
  ver o texto aparecendo; recarregar a página no meio da geração e confirmar que o texto
  parcial está no banco; pedir uma correção no chat e confirmar que só a seção pedida
  mudou; editar à mão, pedir outra correção e confirmar que a edição foi respeitada;
  restaurar uma versão anterior; baixar `.docx` e `.txt`.
- Segurança: com usuário `USUARIO` sem ser responsável pela ata, confirmar 403 na rota de
  geração e leitura vazia via RLS; confirmar que `/config/atas` recusa não-`ADMIN`.
- Comparar o resultado com uma ata gerada hoje no ChatGPT para a mesma assembleia — é o
  critério que importa.

## Riscos assumidos

- **Id do modelo.** `sol` entra como default do banco porque foi o pedido; se o id da API
  divergir, o botão "Testar modelo" mostra isso na hora e a correção é um campo de texto,
  sem deploy.
- **Teto de duração.** `maxDuration = 800` cobre com folga o cenário medido, mas uma
  assembleia excepcionalmente longa pode estourar. O texto parcial fica salvo e "Continuar"
  retoma — nenhum trabalho se perde.
- **Custo.** Cada turno reenvia transcrição e PDFs. Aceito nesta fase: são 2–3 assembleias
  por semana. Se virar problema, o caminho é cache de prompt da OpenAI, não redesenho.
