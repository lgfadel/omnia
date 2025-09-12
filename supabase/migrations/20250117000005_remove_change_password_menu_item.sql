-- Migration: Remove "Alterar Senha" menu item
-- Created: 2025-01-17
-- Description: Removes the "Alterar Senha" menu item as it should only appear in the footer

-- Remove the "Alterar Senha" menu item from omnia_menu_items
DELETE FROM omnia_menu_items 
WHERE name = 'Alterar Senha' AND path = '/change-password';

-- Add comment about the change
COMMENT ON TABLE omnia_menu_items IS 'Stores all menu items for the OMNIA permission system. Password change is handled in footer, not in menu.';