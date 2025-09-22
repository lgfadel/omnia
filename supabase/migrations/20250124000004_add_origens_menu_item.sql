-- Migration: Add Origens menu item to configuration section
-- Created: 2025-01-24
-- Description: Adds the "Origens" menu item to the configuration section

-- Add Origens menu item to configuration section
DO $$
DECLARE
  config_id UUID;
BEGIN
  -- Get the configuration parent ID
  SELECT id INTO config_id FROM omnia_menu_items WHERE path = '/config';
  
  -- Insert Origens menu item if config parent exists
  IF config_id IS NOT NULL THEN
    INSERT INTO omnia_menu_items (name, path, icon, parent_id, order_index) VALUES
      ('Origens', '/config/origens', 'MapPin', config_id, 8);
  END IF;
END $$;

-- Add comment
COMMENT ON TABLE omnia_menu_items IS 'Updated to include Origens menu item for CRM lead sources management';