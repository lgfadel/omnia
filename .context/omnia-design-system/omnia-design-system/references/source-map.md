# Origem e limites do pacote

Snapshot preparado a partir do código local do Omnia em **27/10/2026**. A skill é autocontida: os caminhos abaixo identificam as fontes originais; as cópias incluídas ficam em `assets/reference-source/`, preservando o caminho relativo a `apps/web-next/`. Não é necessário ter o repositório Omnia disponível para usá-la.

| Padrão | Fonte original no Omnia |
| --- | --- |
| Composição do aplicativo | `apps/web-next/src/components/layout/Layout.tsx` |
| Sidebar, grupos e conta | `apps/web-next/src/components/layout/AppSidebar.tsx` |
| Topbar | `apps/web-next/src/components/layout/TopBar.tsx` |
| Estado e painel móvel do menu | `apps/web-next/src/components/ui/sidebar.tsx`, `src/hooks/use-mobile.tsx`, `src/hooks/useEscapeKey.ts` |
| Ajustes de layout | `apps/web-next/src/app/styles/layout-responsive.css` |
| Tokens claro/escuro | `apps/web-next/src/app/globals.css`; blocos extraídos em `assets/omnia-tokens.css` |
| Mapeamento Tailwind | `apps/web-next/tailwind.config.ts` |
| Registro das fontes | `apps/web-next/src/app/layout.tsx` |
| Breadcrumb | `apps/web-next/src/components/ui/breadcrumb-omnia.tsx` |
| Tabela compartilhada | `apps/web-next/src/components/ui/tabela-omnia.tsx` |
| Filtros, ordenação e agrupamento | `apps/web-next/src/app/tarefas/page.tsx` |
| Tags no formulário | `apps/web-next/src/components/atas/TagInput.tsx`, `src/components/tickets/TicketForm.tsx` |
| Catálogo de tags | `apps/web-next/src/stores/tags.store.ts`, `src/repositories/tagsRepo.supabase.ts` |
| Administração de tags | `apps/web-next/src/components/tags/TagForm.tsx`, `src/components/tags/TagList.tsx` |
| Cores de tags | `apps/web-next/src/utils/tagColors.ts` |
| Cores e iniciais do usuário | `apps/web-next/src/lib/userColors.ts` |
| Fluxo de dados das tarefas | `apps/web-next/src/stores/tarefas.store.ts`, `src/repositories/tarefasRepo.supabase.ts` |
| Menus e permissões | `apps/web-next/src/hooks/useMenuItems.ts`, `src/repositories/menuItemsRepo.supabase.ts` |
| Tags por nomes nas tarefas | `supabase/migrations/20261007120000_tasks_api_tags.sql` |

O snapshot inclui apresentação, utilitários, a página de tarefas com seus filtros/comparadores e exemplos de formulário e catálogo de tags. Os demais arquivos de dados e regras citados na tabela foram consultados para descrever o comportamento, mas não estão necessariamente copiados; o manifest identifica exatamente o que está incluído. Não inclui credenciais, bancos, infraestrutura de autenticação, implementação de notificações/comentários, todos os componentes transitivos ou logotipos. As amostras de acesso a dados são referências, não um backend pronto para uso.

`source-manifest.json` registra cada arquivo copiado e seu SHA-256, além da extração de CSS. Cópias integrais preservam o código original e podem conter imports não resolvidos no pacote; a skill orienta a substituí-los. Não use este diretório como aplicação executável nem como teste de compilação de um novo sistema.

## Origem das decisões

As referências distinguem comportamentos observados de adaptações recomendadas. Estas adaptações corrigem limites encontrados na fonte: larguras conflitantes de sidebar, ativação de menu em páginas de detalhe, fonte não mapeada explicitamente, ordenação de status com ordem zero, grupos identificados por nome, criação concorrente de tags, inclusão local após falha e ausência de cancelamento de busca.

As permissões e políticas de dados devem seguir o domínio do destino. A skill não transporta automaticamente políticas de Supabase, rotas internas ou permissões administrativas do Omnia.

O trabalho de extração foi por leitura de código. Uma futura aplicação precisa ser executada e verificada em navegador para confirmar a aparência final. A skill não substitui essa verificação nem declara que todos os componentes do Omnia já cumprem contraste, tema escuro ou acessibilidade.
