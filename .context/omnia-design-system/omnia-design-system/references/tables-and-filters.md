# Tabelas e filtros

## Aparência compartilhada

Use uma tabela de trabalho como a `TabelaOmnia`. A implementação pode ser outra, desde que preserve apresentação e interações. A versão original contém renderizadores específicos de tarefas, atas, transcrição e recorrência; extraia apenas o necessário ao domínio.

| Parte | Referência |
| --- | --- |
| Wrapper | Branco, borda, raio lg, overflow interno |
| Table | `table-fixed w-full`, texto 14 px |
| Cabeçalhos | 12 px, uppercase, tracking-wide, texto secundário, `py-4 px-2` |
| Linhas | `h-12`, células `py-4 px-2`, divisórias gray-100, hover gray-50 |
| Conteúdo de células | Texto 14 px; títulos truncados; tooltip quando relevante |
| Separador de grupo | Fundo gray-50, `py-3 px-2`, chevron, ponto colorido de 8 px, nome uppercase e contagem |
| Responsável | Avatar de 32 px; iniciais e cor estável; opções do menu com avatar de 24 px |
| Status | Badge compacto, fundo da cor cadastrada, texto legível e chevron se editável |
| Tags ao lado do título | Duas visíveis, depois `+N`; fonte 10 px, altura 16 px |
| Ações | Ícones de 16 px em botões ghost de 32 px |

A altura de 48 px é uma classe de referência, não uma garantia de altura final: o padding e conteúdo podem aumentar a linha. Não fixe uma altura que corte os controles.

Contêiner de tabela com rolagem horizontal em telas pequenas. Defina larguras mínimas para evitar sobreposição e mantenha título e ações utilizáveis. O original possui percentuais de colunas que somam mais de 100%; normalize com uma grade coerente no destino, reservando espaço para ações. A tabela original não oferece redimensionamento ou arraste de colunas.

## Colunas de tarefas e sua generalização

| Tarefas no Omnia | Papel reutilizável |
| --- | --- |
| `ticketIdDisplay` (#) | Código legível do registro, separado do ID interno |
| `title` + tags | Nome ou assunto principal |
| `priority` | Prioridade quando fizer sentido |
| `dueDate` | Prazo ou data relevante |
| `responsible` | Pessoa responsável |
| `ticketOcta` | Referência externa; opcional |
| `statusId` | Estado do fluxo do módulo |
| `commentCount`, `attachmentCount` | Contadores, se houver comentários/anexos |
| Ações | Ver/editar/excluir conforme o domínio e a permissão |

Não imponha prioridade e prazo a cadastros de clientes, nem contadores a módulos sem comentários. Para contratos, por exemplo: código, título, cliente, vencimento, responsável e status; para estoque: código, produto, categoria, saldo e situação. A estrutura visual continua a mesma.

Use colunas tipadas com renderizadores por coluna, em vez de depender de nomes mágicos e `any` em um componente compartilhado. Dados de negócio e valores para ordenação devem permanecer separados de elementos React usados para exibição.

## Interações

- Clique na linha abre o detalhe; a ação Ver faz o mesmo. Garanta uma âncora ou botão acessível pelo teclado para o destino.
- Status, responsável, prioridade, tags, calendário, seleção e ações devem impedir propagação do clique para a linha.
- Status editável: menu com ponto colorido e nome; salvar por ID, não pelo rótulo.
- Responsável editável: avatar com menu de pessoas; sem responsável, círculo tracejado com `+`. Restrinja edições conforme as regras do domínio. Em tarefas privadas, a página original impede a troca de responsável; isso não é regra universal.
- Prioridade: bandeira colorida + texto. Urgente vermelha, Alta amarela, Normal azul, Baixa cinza. Ordem semântica `URGENTE < ALTA < NORMAL < BAIXA` no comparador, não ordem alfabética.
- Prazo: data `dd/MM/yyyy`, popover de calendário; sem data, `-`. Fica atrasado quando anterior ao dia local atual, não no próprio dia. O seletor atual não oferece remover data; adicione esse controle somente se o domínio exigir.
- Referência externa: edição inline opcional; Enter ou blur confirma, Escape cancela, trim antes de salvar. Impedir envio duplicado e preservar edição se falhar. Identificador público não precisa ser editável.
- Comentários: ícone + número abre diálogo, atualizando contagem após alterações. Anexos mostram ícone + número; clique para listar é decisão do destino, não um comportamento existente no contador original.
- Excluir pede confirmação. Em suporte, arquivar pode ser mais adequado, conforme o pedido e o modelo de dados.

A primitiva suporta seleção e expansão opcionais, mas a tela de tarefas não ativa seleção em massa. Não transforme essas capacidades em funções obrigatórias. Se combinar grupos, seleção e expansão, calcule `colSpan` pelo número real de colunas; não copie o cálculo incompleto de um dos ramos originais.

## Barra de filtros

Busca expansível com Search de 16 px à esquerda, input de altura 40 px e padding esquerdo 40 px. À direita: menu de status com checkboxes, botão de incluir concluídos, botão de privados, avatar “meus”, quando aplicáveis. Desktop: linha com gap 16 px; celular: empilhar busca e quebrar controles sem esconder funções.

Na página original de tarefas, os filtros são estado React local. Não há persistência de busca/filtros na URL ou localStorage. A busca é aplicada localmente em cada mudança, sem debounce nessa página; não confundir com o debounce de autocomplete de tags.

Contrato original de tarefas:

| Filtro | Estado inicial | Regra |
| --- | --- | --- |
| Meus | Ativo | `assignedTo.id === userProfile.id` |
| Busca | Vazia | Título OU descrição OU referência externa OU número público; ignora caixa |
| Status | Nenhum selecionado | Sem seleção não restringe; múltiplos IDs têm semântica OU |
| Incluir concluídos | Desativado | Oculta finais; ativar inclui também os demais |
| Apenas privados | Desativado | Desativado não restringe por privacidade; ativo mantém só privados já autorizados |
| Tag | Nenhuma | Uma tag por vez, igualdade exata do nome no array |

Os filtros diferentes se combinam com **E**. Selecionar um status final continua sem exibi-lo enquanto “incluir concluídos” estiver desativado. Não interpretar esse botão como “somente concluídos”.

Busca numérica aceita `#123` ou `123` por substring do número; o `#` é removido apenas para a comparação numérica. O código não normaliza acentos. Se implementar busca sem acentos ou trim consistente no destino, registre como adaptação.

Os finais são identificados por `isFinal` ou pelos nomes contendo “concluído”/“finalizado” no legado. No destino, prefira `isFinal` explícito e mantenha nomes livres. Status desconhecidos não são removidos pelo filtro de concluídos no original.

Clique na badge de tag define o filtro; clicar novamente na mesma tag limpa. Uma faixa “Filtrando por tag: [nome ×]” permite limpar sem procurar outra linha. Clicar em outra tag substitui a seleção, não adiciona uma segunda.

## Ordenação e grupos de tarefas

Sem ordenação explícita, a ordem é:

1. `status.order` crescente.
2. Prazo crescente, sem prazo por último.
3. Prioridade: urgente, alta, normal, baixa.
4. Criação decrescente.

Agrupe por status, com nome, cor e contagem dos registros filtrados, e grupos recolhíveis. No snapshot, o agrupamento usa o nome do status; no destino, use seu ID para evitar colidir nomes iguais. O código usa `order || 999`, que trata zero como ausente; prefira `order ?? 999` para respeitar ordem zero.

Ao clicar em Vencimento ou Prioridade, a sequência é **crescente → decrescente → padrão**, e a lista fica plana enquanto existe ordenação explícita. Trocar a coluna começa em crescente.

| Coluna escolhida | Comparação principal | Desempates |
| --- | --- | --- |
| Vencimento | Data no sentido escolhido; nulos sempre por último | Prioridade crescente, ordem do status crescente |
| Prioridade | Ordem semântica no sentido escolhido | Prazo crescente/nulos por último, ordem do status crescente |

Adicione ID como desempate estável se a paginação do destino exigir. Outros cabeçalhos só ordenam se isso for implementado: a página original marca apenas prazo e prioridade como ordenáveis. Acessibilidade: `aria-sort` no cabeçalho e botão com nome claro para ordenar.

Em módulos sem fluxo de status, uma lista plana e uma ordenação adequada são a escolha padrão. Preserve a estrutura de filtros e o desenho da tabela sem forçar regras de tarefas a todo domínio.

## Dados, atualização e volume

Fluxo original: página → store Zustand → repositório → API oficial `/api/v1/tasks`. Apesar do nome `tarefasRepo.supabase.ts`, os dados de tarefas passam pela API; o catálogo de tags usa acesso Supabase diretamente. Não vincule a UI nova a esse endpoint.

A API é paginada por cursor, mas o repositório original carrega todas as páginas de 100 itens para formar a lista local. Não há paginação visível nessa tela. Para listas grandes no destino, envie filtros e ordenação ao servidor **antes** de paginar, e defina se contagens de grupo são totais ou da página. Aplicar filtros somente à página atual altera o significado de “meus” e das contagens.

No original, eventos em tickets, comentários e anexos provocam recarga da lista. O store mantém os itens durante recarga e distingue primeiro carregamento por `hasLoadedTarefas`. No destino, use invalidação/refetch ou o mecanismo da stack, limpe subscriptions no unmount e evite respostas antigas sobrescreverem filtros novos. Realtime é opcional para o domínio.

Mutações precisam informar falha e manter dados coerentes. Respeite controle de concorrência do backend; a API Omnia preserva o timestamp original para ETag, sem reduzir sua precisão a Date. O destino pode usar outro mecanismo equivalente.
