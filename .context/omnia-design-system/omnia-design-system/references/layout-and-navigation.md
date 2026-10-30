# Layout e navegação

Este documento descreve o código local do Omnia consultado em 27/10/2026. As medidas são derivadas das classes e tokens; não representam medição de uma sessão de navegador. Os ajustes indicados como normalizações são decisões para o sistema de destino.

## Estrutura base

```text
┌──────────────────┬──────────────────────────────────────────┐
│ Marca do sistema │ ☰                              Notificações│
│                  ├──────────────────────────────────────────┤
│ PRINCIPAL        │ Home › Módulo                            │
│  Início          │ Título                             [+]   │
│  Módulo A        │                                          │
│  Módulo B        │ [Busca................] [Filtros] [Meus]  │
│                  │                                          │
│ CONFIGURAÇÕES    │ Tabela / formulário / conteúdo do módulo │
│  Cadastros     › │                                          │
│  Usuários        │                                          │
│                  │                                          │
│ Nome do usuário  │                                          │
│ e-mail           │                                          │
│ Conta / Sair     │                                          │
└──────────────────┴──────────────────────────────────────────┘
```

Notificações só aparecem quando houver essa função no destino. “Meus” é um filtro opcional da listagem, não um controle obrigatório de todas as páginas.

Composição original: `SidebarProvider > Layout > AppSidebar + (TopBar + main)`. O wrapper usa `flex min-h-screen w-full overflow-hidden`; a coluna de conteúdo usa `flex flex-col flex-1 min-w-0`. O `main` tem `flex-1 p-4 md:p-6 bg-background overflow-auto`. O `min-w-0` evita que tabelas largas empurrem o menu para fora da tela.

## Medidas e hierarquia

| Elemento | Referência Omnia | Aplicação no destino |
| --- | --- | --- |
| Sidebar aberta | `w-64`, variável `16rem` | 256 px com base de 16 px |
| Sidebar recolhida | AppSidebar usa `w-14`; primitiva define `3rem` para o espaço reservado | Normalizar painel e espaço reservado para 56 px |
| Menu móvel | Primitiva Sheet: `18rem`; CSS legado cita 280 px | Normalizar o painel móvel para 288 px, limitado à largura da tela |
| Breakpoint do menu | `useIsMobile`: abaixo de 768 px | Painel móvel abaixo de 768 px; lateral fixa a partir disso |
| Topbar | `h-14`, `border-b`, fundo semitransparente | 56 px; padding horizontal 16/24 px |
| Conteúdo | `p-4 md:p-6` | 16 px no celular, 24 px em desktop |
| Blocos da página | `space-y-6` | 24 px entre blocos principais |
| Título de listagem | `text-3xl font-bold` | 30 px, peso 700 |
| Ação criar | `w-12 h-12 rounded-lg`, ícone Plus | 48 × 48 px; nome acessível “Novo [recurso]” |
| Painel de filtros | `bg-white rounded-lg border p-6` | Superfície branca, borda fina, padding 24 px |
| Painel de tabela | `bg-white rounded-lg border overflow-hidden` | Mesmo contorno do painel de filtros |
| Formulário principal | `Card w-full max-w-4xl mx-auto` | Máximo 896 px, centralizado |

As diferenças de largura na sidebar original são sobreposições entre a primitiva, AppSidebar e CSS legado. Resolva essa discrepância no destino em uma única fonte de tokens. Não prometa igualdade pixel a pixel a partir deste snapshot sem comparação em navegador.

## Cores e tipografia

`assets/omnia-tokens.css` contém os blocos claro e escuro extraídos do original. `design-tokens.json` contém os mesmos tokens claros e as paletas de tags e usuários. Os valores HSL do JSON não incluem a função: use `hsl(var(--primary))` em CSS.

| Token claro | Valor |
| --- | --- |
| Fundo | `hsl(0 0% 98%)` |
| Superfície | `hsl(0 0% 100%)` |
| Texto principal | `hsl(215 28% 17%)` |
| Primário | `hsl(214 84% 45%)` |
| Texto secundário | `hsl(215 15% 44%)` |
| Borda | `hsl(220 13% 91%)` |
| Raio base | `0.375rem` |

O código define `rounded-lg` como `var(--radius)` e `rounded-md` como `calc(var(--radius) - 2px)`. Botões de avatar são circulares. Os painéis de filtros e tabela usam `rounded-lg`; não aplique o raio de 20 px visto em um dropdown específico a todos os componentes.

O layout original registra as variáveis Geist Sans e Geist Mono via `next/font`. A configuração Tailwind consultada não mapeia `fontFamily` para essas variáveis, e o body usa apenas suas classes de variável. Portanto, o registro não comprova que Geist seja a fonte efetivamente aplicada a toda a interface. Para uma base consistente nova, adote explicitamente `font-family: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif` como normalização; use Mono apenas em identificadores quando necessário. Outra fonte depende da identidade pedida pelo usuário.

Padrão inicial: tema claro. A existência de tokens escuros não garante que todos os componentes originais sejam compatíveis: vários usam `bg-white` e cinzas fixos. Se tema escuro fizer parte do pedido, converta esses usos para tokens e verifique todas as telas.

## Contrato dos menus

O Omnia consulta um cadastro de menus e permissões. Em outra aplicação, um arquivo de configuração local, um CMS ou uma API pode fornecer a mesma árvore; o banco original não é requisito.

Contrato sugerido, independente do armazenamento:

```ts
type NavigationItem = {
  id: string;
  label: string;
  href?: string;
  icon: string;             // chave de um mapa explícito de ícones
  section: 'main' | 'settings';
  order: number;
  permission?: string;
  children?: NavigationItem[];
};
```

- Logo no topo, com espaço equivalente a `p-4` e área de altura `h-12`. Expandida: marca de altura 40 px; recolhida: símbolo de 24 px. Receba o logo do novo sistema; não mantenha URLs de imagens do Omnia como dependência remota.
- Grupo **Principal**: módulos de trabalho em ordem configurada. Grupo **Configurações**: cadastros e administração. O original identifica esse grupo pelo prefixo `/config`; `section` torna a mesma estrutura independente de rotas.
- Configurações ordenadas alfabeticamente em pt-BR, sem diferenciar caixa/acentos e com comparação numérica; `order` serve de desempate. A navegação principal mantém a ordem configurada.
- Um item com filhos alterna a expansão com chevron; folhas navegam. O original mostra filhos diretos; profundidade adicional exige implementação específica.
- Ícones Lucide de 16 px, texto de 14 px, truncamento de nomes longos. Quando recolhida, mantenha ícones e forneça tooltip e nome acessível para cada destino.
- Item ativo: fundo de accent, texto de accent. No snapshot, o teste de rota é igualdade exata. Para páginas de detalhe, prefira ativação por limite de segmento (`path === href` ou `path.startsWith(href + '/')`), com tratamento especial para `/`. Isso é uma adaptação intencional.
- Expansões vivem em estado local no original. A primitiva escreve cookie de abertura por sete dias, mas não lê esse cookie no provider. Persistência entre recarregamentos exige leitura explícita no destino; não a descreva como pronta.
- Ctrl/Cmd+B alterna o menu; o botão da topbar oferece a mesma ação. No celular, abrir em painel sobreposto com Escape, controle de foco e fechamento ao navegar.
- Rodapé: nome e e-mail, ações de conta e Sair. Integrações e Alterar Senha são funções do Omnia: só inclua quando existirem no destino.
- Filtre itens inativos e sem permissão; remova pais vazios. Mostre skeleton enquanto carrega e mensagem com recuperação em falha. A perda de permissão deve refletir imediatamente no menu.

O bloqueio de `/crm` presente no Omnia é uma decisão daquele produto e não deve ser transferido para novos sistemas.

## Topbar e breadcrumb

Topbar com botão de recolher à esquerda, área intermediária flexível e notificações à direita quando suportadas. Não acrescentar pesquisa global ou atalhos sem necessidade do domínio.

Breadcrumb: Home com ícone de casa e link para início; separadores ChevronRight; ancestrais navegáveis; página atual com texto principal e peso médio. Use nomes e rotas reais do destino, `aria-label="Navegação estrutural"` e `aria-current="page"`. Permita rolagem horizontal interna em nomes longos sem gerar rolagem da página inteira.

## Formulários, detalhes e feedback

- Criação/edição: breadcrumb, título, Card de conteúdo. Seções com `space-y-6`, títulos de seção `text-lg font-medium`, grupos de campos `space-y-2` e grid `grid-cols-1 md:grid-cols-2 gap-4`.
- Rótulos visíveis; obrigatórios sinalizados por `*`; erros próximos aos campos, em cor destructive e associados por `aria-describedby`.
- Input: altura 40 px, borda input, padding horizontal 12 px, raio md, fonte 16 px no celular e 14 px em desktop. Foco com anel de 2 px.
- Botões: padrão primário; `outline` para Cancelar/ações secundárias; `ghost` para ações discretas; `destructive` para confirmar exclusão. Preservar estados disabled e texto “Salvando...”.
- Ações de formulário ao final, alinhadas à direita; em telas estreitas podem quebrar linha mantendo a ordem. Cancelar precisa executar uma navegação ou cancelamento real; o botão sem handler no formulário original não é um comportamento a reproduzir.
- Detalhes: mesma moldura e breadcrumb, conteúdo dividido por seções, botões de edição visíveis conforme permissão. Não inventar métricas para preencher espaço.
- Exclusão: diálogo de confirmação com nome do registro, Cancelar e Excluir. Fechar apenas após sucesso; em falha, preservar contexto e mostrar erro.
- Durante atualização, evite apagar a lista ou substituir toda a página por spinner. No carregamento inicial, skeleton ou spinner com texto; no vazio, mensagem e ação pertinente. Erro com recuperação preserva filtros e dados válidos quando possível.
