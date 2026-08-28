-- A rota /relatorios não existe na aplicação. Manter o item ativo faz o
-- Next.js pré-carregá-la na sidebar e emitir 404 para cada sessão autenticada.
-- Desativar preserva o registro e suas permissões para uma futura implementação.
UPDATE public.omnia_menu_items
SET is_active = false
WHERE path = '/relatorios'
  AND is_active = true;
