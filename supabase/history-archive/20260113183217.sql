-- Aplicada em produção via dashboard, sem arquivo local correspondente.
-- Versão original em supabase_migrations.schema_migrations: 20260113183217
-- Arquivada antes do repair --status reverted que reconciliou o histórico.

-- Adicionar item de menu principal "Admissões"
INSERT INTO omnia_menu_items (name, path, icon, order_index, is_active)
VALUES ('Admissões', '/admissoes', 'UserPlus', 3, true);

-- Adicionar item de config "Status de Admissão" como submenu de Configurações
INSERT INTO omnia_menu_items (name, path, icon, parent_id, order_index, is_active)
SELECT 'Status de Admissão', '/config/admissao-status', 'Settings', id, 4, true
FROM omnia_menu_items WHERE path = '/config';

-- Adicionar permissões para o menu principal de Admissões
INSERT INTO omnia_role_permissions (role_name, menu_item_id, can_access)
SELECT 'ADMIN', id, true FROM omnia_menu_items WHERE path = '/admissoes'
UNION ALL
SELECT 'SECRETARIO', id, true FROM omnia_menu_items WHERE path = '/admissoes'
UNION ALL
SELECT 'USUARIO', id, true FROM omnia_menu_items WHERE path = '/admissoes';

-- Adicionar permissões para config (apenas admins)
INSERT INTO omnia_role_permissions (role_name, menu_item_id, can_access)
SELECT 'ADMIN', id, true FROM omnia_menu_items WHERE path = '/config/admissao-status';
