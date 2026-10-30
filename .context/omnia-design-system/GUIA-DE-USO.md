# Reutilizar o design do Omnia em outros sistemas

A skill **omnia-design-system** orienta um agente de código a criar ou adaptar aplicações com o layout do Omnia, mudando o domínio de negócio. Ela reúne regras de apresentação, comportamentos, tokens e cópias locais dos componentes de referência.

## O que está padronizado

- Layout com menu lateral recolhível, topbar, breadcrumb e área de conteúdo.
- Grupos Principal e Configurações, submenus e área do usuário.
- Cores, escalas, espaçamentos, botões, campos, cards e feedback.
- Tabelas, ações por linha, filtros, status, prioridades, responsáveis e agrupamento.
- Formulários de cadastro/edição e confirmação de exclusão.
- Tags com catálogo, cores, autocomplete e filtro por clique.
- Botão “meus itens”, adaptável à relação do usuário com cada módulo.
- Verificações de responsividade, interações, falhas e permissões.

Os módulos não precisam se chamar Tarefas ou Tickets. Um cadastro de clientes pode usar tabela plana; contratos podem usar status e responsáveis; um help desk pode aproveitar o fluxo completo de tarefas.

## Usar nesta máquina

A pasta da skill pode ser instalada no diretório de skills do Codex. Após a instalação, abra uma nova sessão no projeto de destino e use:

```text
Use $omnia-design-system para criar um sistema de [objetivo].
Os módulos são [módulos]. Os usuários são [perfis].
Use o layout, a estrutura de menus, as tabelas e os formulários do Omnia.
Adapte os campos e as regras ao meu domínio e à stack deste projeto.
```

Se o projeto estiver vazio, informe a stack preferida ou deixe o agente propor uma escolha. Se houver código, peça para aproveitar as convenções e integrações existentes.

Exemplo concreto:

```text
Use $omnia-design-system para criar um sistema de suporte.
Módulos: painel, tickets, clientes e configurações de status, tags e usuários.
Quero a tabela agrupada por status, edição inline de prioridade e responsável,
tags com autocomplete e botão Meus tickets por atendente atribuído.
Mantenha autenticação e API deste projeto.
```

## Levar para outro projeto ou computador

O ZIP distribuído contém uma pasta `omnia-design-system/`. Extraia-a para um diretório de skills reconhecido pelo seu agente, como `~/.codex/skills/` no Codex, mantendo `SKILL.md`, `references/`, `assets/` e `agents/` juntos. Se já existir uma pasta com esse nome, compare antes de substituir.

Para disponibilizar a skill somente dentro de um projeto que usa descoberta de skills em `.agents/skills`, a estrutura é:

```text
seu-projeto/
  .agents/
    skills/
      omnia-design-system/
        SKILL.md
        references/
        assets/
        agents/
```

Se o agente não descobrir a skill automaticamente, peça explicitamente: “Leia o arquivo `.agents/skills/omnia-design-system/SKILL.md` e use suas referências para implementar este pedido”. O pacote não depende de ferramentas proprietárias para leitura dos arquivos.

## Leitura como documento

O ponto de entrada é [SKILL.md](omnia-design-system/SKILL.md). As referências também funcionam como documentação técnica independente:

- [Layout, menus e formulários](omnia-design-system/references/layout-and-navigation.md).
- [Tabelas, filtros e ordenação](omnia-design-system/references/tables-and-filters.md).
- [Tags e botão meus itens](omnia-design-system/references/tags-and-ownership.md).
- [Adaptação por domínio e checklist de aceite](omnia-design-system/references/adapt-and-verify.md).

## Limite do entregável

Esta é uma skill de geração e adaptação assistida, com referências de código; não é um comando que gera sozinho um aplicativo pronto. Os componentes originais incluídos precisam de adaptação para a stack e o backend do destino. A implementação resultante deve ser executada e verificada no projeto em que for aplicada.
