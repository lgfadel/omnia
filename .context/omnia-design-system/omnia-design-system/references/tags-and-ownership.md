# Tags e filtro “meus itens”

## Tags: mecanismo original

Existe um catálogo central `Tag { id, name, color, createdAt, createdBy?, updatedAt }`, compartilhado entre telas. Cada tarefa armazena `tags: string[]` com **nomes**, não IDs. Atas têm uma relação própria; não confundir os dois modelos.

Fluxo no formulário: `TagInput` recebe o array selecionado e `onTagsChange`; usa store e repositório para buscar ou criar o cadastro. O catálogo persiste separadamente da vinculação à tarefa.

Comportamento:

- Campo “Tags”, selecionadas em badges com ação de remover, input e botão Adicionar.
- Sugestões após 300 ms, com mais de um caractere; busca por trecho ignorando caixa, até dez resultados ordenados por nome.
- Tags já selecionadas são excluídas das sugestões.
- ArrowDown/ArrowUp percorrem opções; Enter escolhe a destacada ou adiciona o texto; Escape fecha. Sem sugestões abertas, Enter ou vírgula adiciona.
- Texto digitado é aparado nas bordas. Seleção duplicada é bloqueada por igualdade exata do nome.
- `getOrCreate` busca pelo nome exato; se ausente, gera uma cor e cria o cadastro antes de atualizar a seleção.
- No formulário de tarefa, os chips selecionados são neutros. Na tabela, as tags ao lado do título usam as cores do catálogo; a administração de tags usa badges preenchidas.
- A tabela mostra as duas primeiras tags e `+N` para o restante. O `+N` original não abre um seletor; disponibilize os nomes restantes no detalhe ou em controle acessível se necessário.
- Clique em uma tag da tabela ativa filtro único e não abre o registro.

Visual das badges na tabela: texto e borda na cor cadastrada; fundo HEX com alpha `20`, por exemplo `#3b82f620`. Isso corresponde a aproximadamente 12,5% de opacidade. Essa concatenação só funciona para HEX de seis dígitos; valide o formato ou converta a cor antes. O texto colorido precisa continuar legível.

## Cores

`assets/design-tokens.json` inclui a paleta original com **102 cores** de tags. Para uma nova tag, o original escolhe aleatoriamente uma cor ainda não usada; quando a paleta termina, tenta gerar HSL e converter para HEX. A cor fica persistida: não sorteie de novo a cada renderização.

O fallback do código limita tentativas e não garante unicidade absoluta, nem distância perceptiva ou contraste. A cor é um auxílio visual; o nome continua obrigatório. Em um catálogo grande ou multiempresa, compartilhar uma cor entre tags pode ser aceitável conforme as regras do projeto.

No formulário de administração original, novas tags recebem cor automática em inicializador lazy e a edição mantém a cor atual. Não há seletor de cor nesse formulário, embora o repositório suporte update de cor. Oferecer escolha manual é uma decisão do destino.

## Persistência no destino

Escolha conforme o projeto:

| Modelo | Quando usar | Consequência |
| --- | --- | --- |
| Array de nomes + catálogo | Compatibilidade com dados Omnia ou modelo simples existente | Renomear/excluir catálogo exige tratar referências por nome |
| `tags` + tabela de vínculo por ID | Aplicação nova com tags renomeáveis | Mantém identidade e cor após renomear; requer join/consulta equivalente |

Não há obrigação de usar Supabase. Contratos úteis: listar catálogo, buscar, obter-ou-criar, renomear/excluir conforme permissão e substituir tags do registro. Se houver múltiplas organizações, escopar catálogo, busca e vínculos pelo mesmo contexto autorizado.

Normalização de nomes é uma decisão explícita. O código original não considera automaticamente `Financeiro` e `financeiro` a mesma tag para criação. Para unificação no destino, use chave normalizada e uma constraint única no escopo; preserve um rótulo de exibição. Obter-ou-criar deve resolver a disputa entre duas criações concorrentes lendo o registro vencedor.

Ao remover um chip do formulário, remova apenas o vínculo daquele registro, não a tag global. Renomear ou apagar uma tag global precisa de política definida para registros existentes; referências por ID simplificam isso. Revise permissões de manutenção do catálogo separadas da permissão para aplicar tags.

## Limitações do original que precisam de tratamento

- O `TagInput` original adiciona o nome à seleção mesmo se criar o cadastro falhar. Para aplicações novas, mostre a falha e mantenha a seleção consistente com o catálogo; só apresente sucesso após persistência, ou use rollback explícito.
- O debounce limpa o timer, mas não invalida respostas de buscas já iniciadas. Use cancelamento ou número de requisição para impedir sugestão antiga de substituir a nova.
- Bloqueie adicionar enquanto a operação estiver em curso para evitar duplicação e perda de seleção por respostas simultâneas.
- Forneça semântica combobox/listbox, foco e botões acessíveis para remover; o X clicável original não é um botão completo.
- Não prometa propagação automática de renomeação no modelo por nomes. A página consulta cores por igualdade exata de nome; se o catálogo não contiver a tag, a badge recebe estilo de fallback.
- A criação Omnia resolve o ID de usuário de domínio a partir do ID de autenticação. Se o destino também separar identidades, faça essa conversão; não suponha que os IDs são iguais.

## Botão “meus”

Na página de tarefas, começa **ativo**. A condição é `task.assignedTo?.id === userProfile.id`. Criador/solicitante não participa dessa comparação. Ao desativar, a lista passa a mostrar todos os registros que o usuário já pode acessar, ainda respeitando busca, status, tag e demais filtros.

Antes de aplicar em outro domínio, mapeie a relação:

| Rótulo | Campo sugerido | Exemplo |
| --- | --- | --- |
| Meus atendimentos | `assignedToId` | Fila atribuída ao atendente |
| Tickets abertos por mim | `requesterId` | Portal do solicitante |
| Meus contratos | `responsibleId` | Carteira do responsável |
| Minhas solicitações | `createdById` | Requisições criadas pelo usuário |

Na ausência de outra definição, preserve o significado do Omnia: atribuído ao usuário. Não combine atribuídos OU criados sem pedido, pois altera o recorte.

A identidade deve ser do mesmo domínio dos registros. Enquanto o perfil está carregando, não aplique um fallback que mostre a fila completa com o botão ativo. O original só filtra se já houver perfil; no destino, espere sua resolução e mostre carregamento, erro ou estado seguro. Em logout/troca de conta, limpe caches associados ao usuário.

### Visual e algoritmo

- Botão circular de **40 × 40 px**, texto de iniciais 12 px, peso médio.
- Ativo: cor cadastrada no usuário ou cor determinística; texto branco, sombra e anel de 2 px com offset de 1 px. O original aplica alpha HEX `50` ao anel.
- Inativo: fundo `#F3F4F6`, texto `#6B7280`, cor de borda `#D1D5DB`, sombra discreta.
- Avatar do usuário ou iniciais; o original usa a primeira letra de cada palavra e fica com as duas primeiras letras, em maiúsculas. Trate espaços repetidos e nome vazio no destino.
- A cor determinística usa o ID, ou nome como fallback: hash de inteiros de 32 bits, `hash = ((hash << 5) - hash) + charCode`; índice `abs(hash) % 16` na `userColorPalette` incluída. A cor explícita do usuário prevalece.
- Valide contraste entre cor de fundo e texto do avatar. Escolher texto escuro quando necessário é uma correção de acessibilidade, sem mudar a cor de identidade.
- Use botão com `aria-label` descritivo, `aria-pressed` refletindo o estado, tooltip e foco visível. Aparência colorida sozinha não informa o estado a todos os usuários.

### Dados e autorização

O backend limita os registros autorizados; o toggle apenas refina a consulta. Em uma lista paginada, envie o filtro de usuário ao servidor antes da paginação. Nunca busque registros de outras contas para depois escondê-los com JavaScript.

Filtros derivados são calculados a partir de dados e estado atual, não mantidos em uma segunda lista copiada via efeito. Em React, `useMemo` pode otimizar essa derivação, mas não é requisito para a regra funcionar.
