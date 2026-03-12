-- Shift Relatórios and Configurações up by 1
UPDATE omnia_menu_items SET order_index = order_index + 1 
WHERE parent_id IS NULL AND order_index >= 5;

-- Insert Balancetes menu item (after Rescisões=4, before Relatórios now=6)
INSERT INTO omnia_menu_items (name, path, icon, parent_id, order_index, is_active)
VALUES ('Balancetes', '/balancetes', 'BookOpen', NULL, 5, true);

-- Add role permissions (valid roles: ADMIN, SECRETARIO, USUARIO)
INSERT INTO omnia_role_permissions (role_name, menu_item_id, can_access)
SELECT roles.role_name, mi.id, true
FROM omnia_menu_items mi, (VALUES ('ADMIN'), ('SECRETARIO'), ('USUARIO')) AS roles(role_name)
WHERE mi.path = '/balancetes';
