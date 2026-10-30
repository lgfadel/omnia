---
name: omnia-design-system
description: Use when creating or adapting business web applications that must follow the Omnia visual standard, including its sidebar, navigation, page layouts, tables, filters, forms, tags, and current-user toggle. Applies across business domains when the user requests the Omnia pattern.
---

# Sistemas no padrão Omnia

Crie aplicações de domínios diferentes com a mesma linguagem visual e os mesmos padrões de interação do Omnia. O domínio define os módulos e as regras; esta skill define a apresentação. Também atende pedidos restritos, como reproduzir apenas uma tabela ou o seletor de tags.

## Fluxo

1. Identifique o objetivo da aplicação, seus módulos, usuários e ações. Aproveite as informações do pedido e do projeto existente. Pergunte apenas o que impede a implementação; registre as demais suposições.
2. Leia [Layout e navegação](references/layout-and-navigation.md) para qualquer aplicação completa. Preserve a composição sidebar → topbar → conteúdo, os grupos de menu e a hierarquia das páginas.
3. Para listagens, leia [Tabelas e filtros](references/tables-and-filters.md). Para tags ou filtro do usuário, leia [Tags e meus itens](references/tags-and-ownership.md). Esses mecanismos são opcionais por módulo.
4. Use [Adaptação e aceite](references/adapt-and-verify.md) para converter o domínio em telas e verificar a entrega. O [exemplo de aplicação](assets/app-blueprint.example.json) demonstra uma configuração fora do domínio de tarefas.
5. Reutilize os tokens de [design-tokens.json](assets/design-tokens.json) ou [omnia-tokens.css](assets/omnia-tokens.css). Consulte os arquivos correspondentes em `assets/reference-source/` para detalhes exatos de renderização. [Proveniência](references/source-map.md) explica o snapshot e suas limitações.

## O que deve permanecer consistente

- Sidebar à esquerda, recolhível em desktop e em painel sobreposto no celular; marca no topo, grupos Principal e Configurações, área do usuário no rodapé.
- Topbar discreta, breadcrumb, título à esquerda, ação principal à direita, painel de filtros e tabela ou formulário abaixo.
- Superfícies claras, azul primário, bordas discretas, densidade de trabalho, ícones Lucide, escalas e estados descritos nas referências.
- Listagens com ações por linha; controles internos funcionam sem disparar a navegação da linha. Prioridade, status, tags e responsáveis usam suas representações próprias quando existirem no domínio.
- Estados de carregamento, erro, vazio, salvamento e acesso coerentes em todos os módulos.

## O que varia por aplicação

Nome e logotipo, módulos, textos, colunas, campos, indicadores, fluxos e permissões. Preserve o azul e as escalas Omnia por padrão; mude identidade visual quando o usuário solicitar. Não transporte módulos de condomínio, rotas `/tarefas`, integrações ou regras de tickets para aplicações que não os utilizem.

Adapte ao framework e à infraestrutura do destino. A stack de referência usa React, Next.js, Tailwind e primitivas Radix; o padrão visual não exige Supabase, um banco específico nem as versões do snapshot. Consulte a documentação atual antes de usar APIs de bibliotecas no destino.

Os arquivos em `reference-source` são referências originais, com imports e acoplamentos do Omnia, **não um scaffold pronto para compilar**. Extraia a apresentação e substitua autenticação, repositórios, comentários, notificações e regras por contratos do destino. Não instale todos os pacotes do Omnia automaticamente.

## Decisões que evitam desvios

- Reproduza o padrão existente; diretrizes genéricas de criatividade não justificam redesenhar o menu ou substituir a tabela por cards.
- A tabela de tarefas inicia agrupada por status; ordenar por prazo ou prioridade produz lista plana. Em cadastro sem status, use lista plana e ordenação apropriada ao domínio.
- “Meus” significa atribuído ao usuário no Omnia. Para outro significado, use rótulo explícito e a chave correspondente.
- Não transforme comportamentos locais em recursos presumidos: persistência de filtros na URL, ordenação de todas as colunas, paginação visível e gráficos são decisões do destino.
- Oculte menus conforme as permissões, e valide as mesmas permissões nas rotas e operações de dados. O filtro “meus” não concede acesso.

Entregue uma aplicação funcional no escopo pedido, os componentes compartilhados, as decisões de adaptação e a evidência das verificações executadas. Se o pedido for somente uma especificação ou protótipo, respeite esse limite e identifique os dados simulados.
