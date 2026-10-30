# Adaptação por aplicação e aceite

## Transformar o domínio em telas

Comece com o que o usuário pediu e com a estrutura do projeto. Registre as decisões em uma configuração ou documento curto: nome, público, módulos, rotas, permissões, campos, estados e ações. O arquivo `assets/app-blueprint.example.json` é um exemplo de decisão, não um formato obrigatório de runtime ou um gerador executável.

| Camada | Compartilhar entre os sistemas | Adaptar ao domínio |
| --- | --- | --- |
| Tema | Tokens, escalas, bordas, densidade e ícones | Logo e nome; outra paleta apenas se solicitada |
| Navegação | Sidebar, grupos, submenu, rodapé e comportamento móvel | Módulos, rotas e permissões |
| Página | Breadcrumb, título, ação, filtros e conteúdo | Títulos e operações |
| Tabela | Cabeçalhos, linhas, badges, menus e ações | Colunas, agrupamento e comparadores |
| Formulário | Campos, grids, seções, erros e ações | Schema e validações de negócio |
| Dados | Contratos de carregamento e mutação | API, banco, autenticação e escopo de acesso |

Uma organização possível no destino:

```text
src/
  design-system/       # tokens e primitivas
  components/layout/  # shell, sidebar, topbar, breadcrumb
  components/data/    # tabela, barra de filtros, avatar meus, seletor de tags
  modules/            # telas, schemas e operações do domínio
  config/navigation  # árvore do menu e permissões exigidas
```

Adapte essa organização às convenções existentes. Não refatore um projeto inteiro para adotar esses nomes.

## Exemplo fora de suporte

**Gestão de contratos**: Principal contém Início, Clientes e Contratos; Configurações contém Status, Tags e Usuários. A listagem Contratos mantém a mesma barra e tabela, com código, título + tags, cliente, vencimento, responsável, status e ações. “Meus contratos” usa `responsibleId`; contratos podem ser agrupados pelo status configurado. Clientes usa uma tabela plana de nome, documento, contato e situação, sem prioridade ou prazo artificiais.

**Suporte**, quando solicitado: tickets mantêm o comportamento de tarefas, com status, prioridade, prazo, atendente, comentários e anexos. Distinga a fila atribuída ao atendente dos tickets abertos pelo solicitante. Estados como Aguardando cliente ou Resolvido pertencem ao domínio e devem ser configuráveis.

Novos módulos precisam de telas e ações reais. Links para destinos inexistentes e botões que não executam uma operação não caracterizam uma aplicação funcional. Se o escopo for protótipo, deixe isso claro e use dados de demonstração identificados.

## Uso dos recursos incluídos

1. Comece pelos tokens e contratos das referências. A composição visual é independente da camada de dados.
2. Leia em `assets/reference-source` os componentes correspondentes ao que está construindo. As cópias preservam os imports para permitir inspeção do original, não para importação direta no destino.
3. Primitivas visuais pequenas, como Button, Input e Card, podem ser adaptadas após resolver aliases, dependências, estilos e limites cliente/servidor. A tabela e a sidebar contêm acoplamentos explícitos: substitua-os por props e adaptadores do destino.
4. O snapshot não inclui credenciais, dados de clientes ou bancos. Não use o projeto Omnia como backend do novo sistema.
5. Para React/Next.js, mantenha estado e handlers em componentes cliente. Extraia tipos de domínio da camada visual. Para outro framework, preserve o contrato de aparência e interação usando suas primitivas locais.
6. Verifique a documentação atual das bibliotecas antes de instalar ou alterar APIs. Não copie as versões antigas ou instale todo o `package.json` de origem.

## Checklist de aceite

### Estrutura e visual

- Desktop: sidebar expandida/recolhida, topbar de 56 px e conteúdo alinhados; sem diferença entre largura do painel e espaço reservado.
- Celular: painel sobreposto, foco controlado, Escape e navegação fecham o menu; conteúdo permanece utilizável.
- Menu Principal/Configurações, configurações em ordem pt-BR, item ativo e links reais. Itens indisponíveis por permissão não aparecem.
- Breadcrumb, título, ação principal, filtros, tabela e formulário mantêm as medidas de referência.
- Tabela em contêiner com rolagem horizontal, sem sobreposição de colunas ou rolagem lateral da aplicação inteira.
- Estados normal, hover, foco, ativo, disabled, vazio, carregando, erro e salvando seguem o mesmo vocabulário visual.
- Em tema escuro, se exigido, não há painéis brancos herdados nem texto sem contraste.

### Comportamento

- Abrir detalhe pela linha e pelo teclado; clicar em tag, menu ou botão não navega por acidente.
- Filtrar por busca, status e meus em conjunto. Remover filtro de tag restaura apenas essa dimensão.
- Em fluxo equivalente a tarefas: iniciar agrupado, ordenar prazo/prioridade em três estados e recuperar grupos ao voltar ao padrão; nulos no final em ambos os sentidos.
- Recolher/abrir grupo sem perder os dados; contagens correspondem ao recorte documentado.
- Tags: buscar, criar, selecionar, impedir duplicação, remover vínculo, preservar cor e lidar com falha/concorrência.
- Meus: comparar a chave correta, aguardar identidade e respeitar usuário/organização após troca de conta.
- Criar/editar com validação, sucesso e erro; Cancelar funciona; confirmação de exclusão persiste em erro.
- Menu oculto não permite contornar autorização entrando diretamente na URL ou chamando a API.

### Evidência

Use testes apropriados à stack para regras relevantes de filtros, comparadores, permissão e falhas. Faça verificação em navegador em larguras como 390, 768 e 1440 px; registre capturas das telas equivalentes quando houver referência visual disponível. Verifique contraste, teclado e nomes acessíveis de controles por ícone.

Não afirme fidelidade visual medida se a validação foi só por leitura de fonte. Não afirme que backend, autenticação ou persistência funcionam com dados simulados. Relate o que foi executado e qualquer limitação concreta.

## Exemplos de invocação

```text
Use $omnia-design-system para criar um sistema de gestão de contratos.
Módulos: clientes, contratos e configurações. Quero tags nos contratos,
botão Meus contratos por responsável e agrupamento por status.
Use a stack deste repositório e preserve o layout Omnia.
```

```text
Use $omnia-design-system para adaptar o sistema existente ao padrão Omnia.
Preserve as regras de estoque e as integrações atuais; padronize navegação,
tabelas, filtros e formulários usando os tokens e contratos da skill.
```

```text
Use $omnia-design-system somente para implementar o seletor de tags e o
botão Meus tickets na listagem existente. Meus = atribuídos ao atendente.
```
