# OMNIA — Sub‑PRD: Módulo de Implantações

> **Documento filho do PRD principal do OMNIA (omnia.md)**. Este sub‑PRD define a funcionalidade **Implantações** (onboarding de novos condomínios), cobrindo objetivos, escopo, requisitos funcionais/técnicos, UX, dados, integrações e critérios de aceite. Todas as decisões aqui **herdam NFRs, padrões de UI/estado e segurança** do PRD pai.

---

## 1. Contexto e Oportunidade

- **Problema**: o onboarding de condomínios é lento, disperso em planilhas/WhatsApp, com alta taxa de retrabalho e pouca visibilidade de status.
- **Oportunidade**: transformar um formulário longo em **etapas guiadas + checklists com Drive**, gerando **rastreabilidade**, previsibilidade de prazos e padronização de entregas.

## 2. Objetivos & Métricas de Sucesso (MVP)

- Reduzir **TME de implantação** (criação → entrega) em ≥ **35%** no 3º mês.
- Atingir **≥ 90%** de implantações com **E3 (jurídico) concluída** até D+7 da criação.
- **Zero** uso de anexos locais fora de **comentários**; 100% dos documentos via **Google Drive**.
- Visibilidade: painel com **% progresso por implantação** e **pendências por etapa**.

## 3. Escopo (MVP) & Fora do Escopo

### 3.1 Incluído (MVP)

- Fluxo em **5 etapas (E1–E5)** com no máx. 8 perguntas por etapa.
- **Checklist jurídico** (E3) com status {Pendente, Solicitado, Recebido} e **link Drive**.
- **Drive Picker** para documentos (E2/E3/E5). Comentários continuam aceitando anexos locais.
- **Kanban de pendências** simples por implantação.
- **Exportação PDF** do resumo + **CSV** (ex.: espaços sociais).

### 3.2 Fora do escopo (MVP)

- Editor visual de templates de implantação (entra v1.1).
- Importadores CSV automáticos (proprietários/escala) — v1.1.
- Integração WhatsApp (Evolution-API) para solicitar docs — v1.1.

## 4. Personas e Perfis

- **Analista de Implantação (Interno)**: conduz etapas, solicita/valida documentos, fecha pendências.
- **Síndico/Cliente (Externo)**: visualiza status (quando habilitado), fornece links do Drive.
- **Gestor Operacional**: acompanha pipeline e gargalos por etapa.

## 5. Requisitos Funcionais

### 5.1 Etapas e Campos Essenciais

**E1 — Identificação & Dados básicos**

- Condomínio (ref), **CNPJ**, **Síndico** (nome, telefone, e-mail)
- **Vencimento do boleto**
- **Data de início dos controles**
- _Não_ possui dados/ upload de contrato

**E2 — Administrativo & Financeiro**

- **Financeiro — Identificação**: **Banco** (obrig.), **Agência** (obrig.), **Gerente** (nome/telefone/e-mail, obrig.)
- **Água**: **Data da ÚLTIMA leitura**; **Modelo** (Rateio | Individual)
- **Gás**: **Data da ÚLTIMA leitura**; **Fornecedor**
- **Elevadores**: Empresa; Manutenção (R$); **Contrato de manutenção (Drive)**
- _Removido_: Obras em andamento

**E3 — Jurídico (Checklist + Drive)**

- **Obrigatórios**: Apólice de seguro (Drive); Convenção (Drive); Regimento interno (Drive); Relação de proprietários — CSV (Drive)
- **Opcional**: Lista de inadimplentes (Drive)
- **Texto**: Ações em curso (observações)

**E4 — RH & Operação**

- Funcionários (quantidade e cargos)
- Escala vigente (descrição) + **Escala — CSV (Drive)** (opcional)
- Benefícios: VT/VA (operadora e último período pago)
- Fechamento da folha (janela/observações)
- **Espaços sociais**: Nome | Valor | Regra‑resumo (edição inline)
- _Removido_: Malotes

**E5 — TH (Treinamento / Handover)**

- Agenda (data, responsáveis, público: Síndico/Portaria/Financeiro)
- Checklist de capacitação (boletos/2ª via; relatórios; espaços; rotinas do síndico; leituras água/gás) — status + **Drive** p/ materiais
- Registro de entrega (data, participantes, notas)

### 5.2 Pendências e Resumo

- Qualquer item não preenchido/recebido pode virar **tarefa** com responsável e prazo.
- Resumo mostra **% progresso por etapa**, status de documentos e links do Drive.

## 6. Requisitos Não Funcionais (herdados + específicos)

- **Usabilidade**: máximo 8 perguntas por etapa; autosave com debounce 500–800ms.
- **Segurança**: links do Drive seguem política corporativa; sem compartilhamentos públicos.
- **Observabilidade**: eventos de alteração de status/documento logados (audit trail).
- **Desempenho**: carregamento de uma implantação ≤ 1.5s em rede 3G boa.

## 7. UX / UI

- **WizardImplantacao** (E1–E5) com header de progresso.
- **ChecklistCompacto** para E3/E5 (chips de status + ícone/ação “Selecionar do Google Drive”).
- **KanbanPendencias** (Não iniciado | Em andamento | Concluído).
- **TabelaEspacosSociais** (edição inline; validações simples).
- **Comentários** por etapa (permitem anexos locais).
- Layout e tokens herdados do design system OMNIA.

## 8. Fluxos Resumidos

1. Criar Implantação → carregar template E1–E5.
2. Preencher E1 → salvar; avançar para E2.
3. Em E2/E3/E5, adicionar **links do Drive** (Picker) nos itens `type=doc`.
4. Itens faltantes → **pendências** (kanban).
5. Resumo → conferência final → exportar PDF/CSV.

## 9. Modelo de Dados (MVP)

### 9.1 Tabelas

- `omnia_implantacoes(id, condominium_id, created_by, started_at, finished_at, status_id, progress_pct, template_version, notes)`
- `omnia_implantacao_steps(id, implantacao_id, code(E1..E5), title, status_id, completed_at, order)`
- `omnia_implantacao_items(id, step_id, label, type(text|date|number|select|bool|doc|group|currency|email|phone|ref), required, value_json, status_id, order)`
- `omnia_implantacao_docs(id, step_id, item_id, status(pendente|solicitado|recebido), drive_file_id, drive_url, updated_at)`
- `omnia_training_events(id, implantacao_id, date, audience(json), owners(json), notes)`

> Observação: Comentários/anexos locais continuam em `omnia_comments`/`omnia_attachments` do PRD pai.

### 9.2 Regras de consistência

- `type=doc` cria/atualiza registro em `omnia_implantacao_docs`.
- E3 concluída quando **obrigatórios** = `status=recebido`.
- E5 concluída quando checklist concluída **ou** há `training_event` com registro de entrega.

## 10. Interfaces / APIs (internas)

**Padrão Repository** (DI) para permitir Mock (MVP) e troca futura por Supabase:

```ts
interface IImplantacoesRepository {
  create(payload): Promise<Implantacao>
  getById(id: string): Promise<Implantacao>
  list(filter): Promise<Implantacao[]>
  updateProgress(id: string, pct: number): Promise<void>
}
interface IStepsRepository {
  listByImplantacao(id: string): Promise<Step[]>
  updateStatus(stepId: string, status: StepStatus): Promise<void>
}
interface IItemsRepository {
  listByStep(stepId: string): Promise<Item[]>
  upsertValue(itemId: string, value: any): Promise<void>
}
interface IDocsRepository {
  upsert(
    itemId: string,
    data: { status: DocStatus; driveUrl?: string; driveFileId?: string }
  ): Promise<void>
}
interface ITrainingRepository {
  upsertEvent(payload): Promise<void>
}
```

**Serviços**: `DriveService.selectFile()` retorna `{driveFileId, driveUrl}`.

## 10A. Camada de Abstração de Dados (pré‑Supabase)

**Obrigatório no MVP.** Antes de propagar mudanças de dados para o **Supabase**, o Módulo de Implantações deve operar sobre uma **Camada de Abstração de Dados** que permita desenvolvimento, testes e validações **sem dependência de banco**.

### Objetivos

- Desacoplar **UI/estado** do provedor de dados.
- Habilitar desenvolvimento **offline/isolado** (Mock) e posterior troca para **Supabase** sem refatorações.
- Garantir **paridade funcional** via testes de contrato entre drivers.

### Escopo

- Implementar os **Repositories** definidos na Seção 10 com dois drivers:
  1. **MockDriver (MVP)**: armazenamento em **memória** com persistência opcional em LocalStorage; seed do **template E1–E5**; geração de IDs determinística; simulação de latência (50–150ms) e falhas controladas para testes.
  2. **SupabaseDriver (v1.1)**: implementação real das mesmas interfaces, respeitando RLS, políticas de segurança e mapeamento 1:1 das tabelas (`omnia_implantacoes`, `omnia_implantacao_steps`, `omnia_implantacao_items`, `omnia_implantacao_docs`, `omnia_training_events`).

### Configuração & Swap

- **Env**: `VITE_OMNIA_DATA_DRIVER=mock|supabase` (default: `mock`).
- **Injeção de dependência** em um `DataProvider` único, trocado por **feature flag** sem rebuild.
- **Telemetria**: registrar driver ativo e latências por operação.

### Testes de Contrato (requisito)

- Uma suíte única de testes deve rodar **idêntica** contra `MockDriver` e `SupabaseDriver`.
- Cobertura mínima **≥ 80%** dos métodos dos repositories.
- Testes incluem: criação/leitura/atualização de itens, mudança de status, cálculo de progresso, vinculação de `type=doc` a `drive_url`.

### Entregáveis

- `src/data/adapters/mock/*.ts` (MockDriver)
- `src/data/adapters/supabase/*.ts` (stubs no MVP; implementação na v1.1)
- `src/data/DataProvider.ts` (factory + DI)
- `src/data/contracts/*.ts` (interfaces — Seção 10)

### Plano de Migração

1. **MVP**: entregar UI/fluxos completos operando em **MockDriver**.
2. **Hardening**: estabilizar fluxos e critérios de aceite com dados mockados.
3. **v1.1**: implementar **SupabaseDriver**; executar testes de contrato; rodar piloto com banco real.
4. **Cutover controlado** por feature flag por condomínio/ambiente.

### Riscos & Mitigações adicionais

- **Divergência Mock vs. Real** → testes de contrato + fixtures reais mínimos.
- **Regras RLS** não mapeadas → checklist de segurança antes do GA v1.1.
- **Latência em produção** → métricas no DataProvider e tracing por operação.

## 11. Template (JSON) — E1–E5

> Base para seed inicial do wizard (pode ser versionado em `template_version`).

```json
{
  "E1_identificacao": {
    "title": "Identificação & Dados básicos",
    "items": [
      { "type": "ref", "label": "Condomínio", "required": true, "value": null },
      { "type": "text", "label": "CNPJ", "required": true, "value": "" },
      {
        "type": "group",
        "label": "Síndico",
        "items": [
          { "type": "text", "label": "Nome", "required": true, "value": "" },
          { "type": "phone", "label": "Telefone", "required": true, "value": "" },
          { "type": "email", "label": "E-mail", "required": true, "value": "" }
        ]
      },
      { "type": "date", "label": "Vencimento do boleto", "required": true, "value": null },
      { "type": "date", "label": "Início dos controles", "required": true, "value": null }
    ]
  },
  "E2_admin_fin": {
    "title": "Administrativo & Financeiro",
    "items": [
      {
        "type": "group",
        "label": "Financeiro — Identificação",
        "items": [
          { "type": "text", "label": "Banco", "required": true, "value": "" },
          { "type": "text", "label": "Agência", "required": true, "value": "" },
          {
            "type": "group",
            "label": "Gerente responsável",
            "items": [
              { "type": "text", "label": "Nome", "required": true, "value": "" },
              { "type": "phone", "label": "Telefone", "required": true, "value": "" },
              { "type": "email", "label": "E-mail", "required": true, "value": "" }
            ]
          }
        ]
      },
      {
        "type": "group",
        "label": "Água",
        "items": [
          { "type": "date", "label": "Data da ÚLTIMA leitura", "required": false, "value": null },
          {
            "type": "select",
            "label": "Modelo",
            "options": ["Rateio", "Individual"],
            "required": false,
            "value": null
          }
        ]
      },
      {
        "type": "group",
        "label": "Gás",
        "items": [
          { "type": "date", "label": "Data da ÚLTIMA leitura", "required": false, "value": null },
          { "type": "text", "label": "Fornecedor", "required": false, "value": "" }
        ]
      },
      {
        "type": "group",
        "label": "Elevadores",
        "items": [
          { "type": "text", "label": "Empresa", "required": false, "value": "" },
          { "type": "currency", "label": "Manutenção (R$)", "required": false, "value": null },
          {
            "type": "doc",
            "label": "Contrato de manutenção (Drive)",
            "status": "pendente",
            "required": false,
            "drive_url": null
          }
        ]
      }
    ]
  },
  "E3_juridico": {
    "title": "Jurídico",
    "items": [
      {
        "type": "doc",
        "label": "Apólice de seguro (Drive)",
        "status": "pendente",
        "required": true,
        "drive_url": null
      },
      {
        "type": "doc",
        "label": "Convenção (Drive)",
        "status": "pendente",
        "required": true,
        "drive_url": null
      },
      {
        "type": "doc",
        "label": "Regimento interno (Drive)",
        "status": "pendente",
        "required": true,
        "drive_url": null
      },
      {
        "type": "doc",
        "label": "Relação de proprietários — CSV (Drive)",
        "status": "pendente",
        "required": true,
        "drive_url": null
      },
      {
        "type": "doc",
        "label": "Lista de inadimplentes (Drive)",
        "status": "pendente",
        "required": false,
        "drive_url": null
      },
      { "type": "text", "label": "Ações em curso (observações)", "required": false, "value": "" }
    ]
  },
  "E4_rh_operacao": {
    "title": "RH & Operação",
    "items": [
      {
        "type": "text",
        "label": "Funcionários — quantidade e cargos",
        "required": false,
        "value": ""
      },
      { "type": "text", "label": "Escala vigente (descrição)", "required": false, "value": "" },
      {
        "type": "doc",
        "label": "Escala — CSV (Drive)",
        "status": "pendente",
        "required": false,
        "drive_url": null
      },
      {
        "type": "group",
        "label": "Benefícios",
        "items": [
          { "type": "text", "label": "VT/VA — operadora", "required": false, "value": "" },
          { "type": "text", "label": "Último período pago", "required": false, "value": "" }
        ]
      },
      {
        "type": "text",
        "label": "Fechamento da folha (janela/obs)",
        "required": false,
        "value": ""
      },
      {
        "type": "table",
        "label": "Espaços sociais (Nome|Valor|Regra)",
        "required": false,
        "value_json": []
      }
    ]
  },
  "E5_th": {
    "title": "Treinamento / Handover",
    "items": [
      { "type": "date", "label": "Data do treinamento", "required": false, "value": null },
      {
        "type": "select",
        "label": "Público",
        "options": ["Síndico", "Portaria", "Financeiro"],
        "required": false,
        "value": []
      },
      {
        "type": "check",
        "label": "Emissão de boletos/2ª via",
        "status": "pendente",
        "required": false,
        "drive_url": null
      },
      {
        "type": "check",
        "label": "Relatórios básicos",
        "status": "pendente",
        "required": false,
        "drive_url": null
      },
      {
        "type": "check",
        "label": "Cadastro de espaços sociais",
        "status": "pendente",
        "required": false,
        "drive_url": null
      },
      {
        "type": "check",
        "label": "Rotinas do síndico",
        "status": "pendente",
        "required": false,
        "drive_url": null
      },
      {
        "type": "check",
        "label": "Leituras (água/gás)",
        "status": "pendente",
        "required": false,
        "drive_url": null
      },
      {
        "type": "text",
        "label": "Registro de entrega (participantes/notas)",
        "required": false,
        "value": ""
      }
    ]
  }
}
```

## 12. Critérios de Aceitação (amostra)

1. Criar implantação e percorrer E1–E5 salvando rascunhos.
2. Em E2, registrar **Banco/Agência** e **Gerente** (sem nº de conta); armazenar **Última leitura** de Água/Gás.
3. Em E2, adicionar **Contrato de manutenção (Drive)** para Elevadores.
4. Em E3, marcar **Apólice/Convenção/RI/Proprietários (CSV)** como **Recebido** (com alerta para informar link do Drive).
5. Exportar PDF com status por etapa e exibição dos links do Drive.

## 13. Telemetria / Indicadores

- Tempo de implantação; etapas em atraso; pendências por tipo; % E3 concluída em D+7; taxa de retrabalho (item reaberto).

## 14. Riscos & Mitigações

- **Links do Drive sem permissão** → Validação/alertas de compartilhamento + guia de permissão.
- **Adoção do time** → Capacitação (E5) + checklists curtos; métricas de uso por etapa.
- **Desvio para anexos locais** → Bloquear anexos fora de comentários + dica de ação para Drive.

## 15. Plano de Lançamento

- **Beta interno (2 semanas)** com 3 implantações piloto.
- **GA** após acertos de UX e relatório de métricas do beta.

## 16. Itens em Aberto

- Política final para obrigatoriedade de `drive_url` ao marcar **Recebido**.
- Definição de pasta padrão no Drive por condomínio (nomenclatura e permissões).

---

## 17. Plano em Fases (para prompts de IA)

> **Finalidade**: Derivar do sub‑PRD um plano executável em fases, que servirá de base para criação de **prompts operacionais** (por agente/etapa) durante a implementação assistida por IA.

### Estrutura padrão de Prompt (reutilizável em toda fase)

```
[CONTEXT] Resumo da fase, objetivo e escopo. Linkar seções do sub‑PRD relevantes.
[INPUTS] Artefatos de entrada (templates JSON, contratos TS, DDL, tokens de design, etc.).
[TASKS] Passo a passo, com critérios de aceite e validações.
[CONSTRAINTS] Regras do PRD (Drive, sem anexos fora de comentários, etc.).
[OUTPUTS] Entregáveis (arquivos, componentes, testes, evidências).
[TESTS] Casos de teste / cenários de uso a validar.
[DEFINITION OF DONE] Itens objetivos para concluir a fase.
```

---

### Fase 0 — Boot & Guardrails

**Objetivo**: Preparar ambiente, padrões e rastreabilidade.

- **Entradas**: este sub‑PRD, tokens/tailwind do OMNIA, padrões de roteamento/estado, checklist de NFRs do PRD pai.
- **Tarefas**: scaffold do app/feature; roteamento `implantações/*`; lint/format/pre-commit; telemetry base; feature flag `VITE_OMNIA_DATA_DRIVER`.
- **Saídas**: pasta `features/implantacoes/*`; rota protegida; logger/telemetry; doc README.
- **DoD**: build limpo; lint+tests rodando; feature flag comuta `mock|supabase` (stub supabase).

### Fase 1 — Camada de Abstração (MockDriver)

**Objetivo**: Operar 100% sem BD.

- **Entradas**: Seções 9–10A (interfaces, DataProvider, plano de migração) + Template E1–E5.
- **Tarefas**: `DataProvider` + `MockDriver`; seeds determinísticos; contratuais de repositório (80%+ cobertura).
- **Saídas**: `src/data/adapters/mock/*.ts`, fixtures e testes.
- **DoD**: suite de contrato passa em `mock`.

### Fase 2 — Shell de UI & Estado

**Objetivo**: Esqueleto do Wizard + Zustand + autosave.

- **Entradas**: tokens UI, estrutura de etapas (E1–E5), eventos de telemetria.
- **Tarefas**: `WizardImplantacao`, store `useImplantacaoStore`, autosave (500–800ms), navegação E1–E5.
- **Saídas**: Wizard funcional com progresso (sem campos ainda).
- **DoD**: criar/abrir implantação, navegar e salvar rascunho.

### Fase 3 — E1 & E2 (Formulários essenciais)

**Objetivo**: Implementar campos de Identificação e Administrativo/Financeiro.

- **Entradas**: requisitos da Seção 5.1 para E1/E2.
- **Tarefas**:
  - **E1**: Condomínio, CNPJ, Síndico, Vencimento do boleto, Início dos controles.
  - **E2**: Banco, Agência, Gerente; Água/Gás com **Data da ÚLTIMA leitura**; Elevadores (empresa, manutenção R$).

- **Saídas**: validações mínimas, máscara básica, autosave.
- **DoD**: dados persistem no Mock; recarga mantém estado.

### Fase 4 — Integração Google Drive (Picker) & `type=doc`

**Objetivo**: Padronizar documentos por **link Drive**.

- **Entradas**: Seções 3.1–3.4 e 5.1 (E2/E3/E5).
- **Tarefas**: `DriveService.selectFile()`; UI `CardDocumento` com status {pendente|solicitado|recebido}; armazenar `drive_file_id/drive_url`.
- **Saídas**: doc items funcionais em E2/E3/E5.
- **DoD**: seleção Drive funcionando e status persistindo.

### Fase 5 — E3 Jurídico (Checklist)

**Objetivo**: Checklist obrigatório/optional com status e Drive.

- **Entradas**: Seção 5.1 (E3) + regras de conclusão de etapa.
- **Tarefas**: itens obrigatórios (Apólice, Convenção, RI, Proprietários CSV); opcional (Inadimplentes); observações.
- **Saídas**: gating suave para “Recebido” (sugerir Drive); cálculo de conclusão da E3.
- **DoD**: E3 marca “Concluída” apenas com obrigatórios recebidos.

### Fase 6 — E4 RH & Operação

**Objetivo**: Campos e tabela inline de Espaços Sociais.

- **Entradas**: Seção 5.1 (E4).
- **Tarefas**: funcionários; escala (descrição) + CSV (Drive) opcional; VT/VA; fechamento de folha; `TabelaEspacosSociais` (Nome|Valor|Regra) com validações simples.
- **Saídas**: edição inline e persistência.
- **DoD**: tabela cria/edita/lê; CSV via Drive link opcional.

### Fase 7 — E5 Treinamento / Handover

**Objetivo**: Agenda e checklist de capacitação com materiais no Drive.

- **Entradas**: Seção 5.1 (E5) + `omnia_training_events` (opcional no MVP).
- **Tarefas**: público (Síndico/Portaria/Financeiro), registros de entrega; checks de capacitação com drive_url.
- **Saídas**: tela E5 completa.
- **DoD**: salvar agenda, checks e registro de entrega.

### Fase 8 — Pendências (Kanban)

**Objetivo**: Converter itens faltantes em tarefas simples.

- **Entradas**: Seção 5.2.
- **Tarefas**: criar modelo de pendência mínima (no próprio módulo ou via tickets com tag), arrastar status, prazo e responsável.
- **Saídas**: `KanbanPendencias` operante.
- **DoD**: criar/mover/concluir pendência com tracking básico.

### Fase 9 — Resumo & Exportações

**Objetivo**: Consolidar entrega.

- **Entradas**: dados de todas as etapas.
- **Tarefas**: página Resumo com % por etapa, lista de docs com ícones/links; export **PDF** (roteiro + status) e **CSV** (ex.: espaços sociais).
- **Saídas**: botão de exportar; layout para impressão.
- **DoD**: PDF/CSV gerados fielmente ao estado atual.

### Fase 10 — Telemetria, Acessos & Critérios de Aceite

**Objetivo**: Observabilidade e conformidade.

- **Entradas**: Seções 6, 8, 12.
- **Tarefas**: eventos (mudança de status, seleção de Drive, conclusão de etapa); verificação de permissões e perfis; validar CAs listados (Seção 12).
- **Saídas**: dashboard interno simples.
- **DoD**: métricas registradas; CAs atendidos.

### Fase 11 — Hardening & Beta Interno

**Objetivo**: Estabilizar e pilotar.

- **Entradas**: backlog de bugs/UX; playbook de teste com 3 implantações piloto.
- **Tarefas**: correções; polimento de UX; documentação de uso.
- **Saídas**: relatório beta com KPIs (tempo, pendências, retrabalho).
- **DoD**: metas de sucesso preliminares atingidas.

### Fase 12 — SupabaseDriver & Migração Controlada (v1.1)

**Objetivo**: Trocar o driver mantendo contrato.

- **Entradas**: DDL (Seção 4.1), políticas RLS, testes de contrato.
- **Tarefas**: implementar `SupabaseDriver`; mapear 1:1 as tabelas; rodar suíte de contrato; ativar **feature flag** por condomínio/ambiente.
- **Saídas**: driver real + guia de migração.
- **DoD**: 100% testes de contrato verdes no supabase; cutover limitado (piloto).

### Fase 13 — GA & Handover

**Objetivo**: Disponibilizar para todos e treinar operação.

- **Entradas**: resultados do beta e v1.1.
- **Tarefas**: treinamento do time; SLOs e runbooks; plano de rollback; comunicação de lançamento.
- **Saídas**: release notes; runbook; plano de suporte.
- **DoD**: GA liberado; métricas ativas e monitoradas.

---

### Mapeamento rápido Fase → Seções do PRD

- **F0–F2**: Seções 6, 7, 10, 10A
- **F3–F7**: Seção 5.1 (E1–E5)
- **F8–F9**: Seção 5.2
- **F10**: Seções 6, 8, 12
- **F11**: Seções 14–15
- **F12**: Seções 4, 9, 10A
- **F13**: Seção 15

### Observações finais

** O **MockDriver é obrigatório\*\* até o corte para Supabase (F12), garantindo velocidade e segurança de desenvolvimento.
