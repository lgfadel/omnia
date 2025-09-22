-- Migração para alterar o nome do menu CRM para "Oportunidades"
-- Data: 2025-01-28

-- Atualizar o nome do item de menu principal de CRM para Oportunidades
UPDATE omnia_menu_items 
SET name = 'Oportunidades' 
WHERE name = 'CRM' AND path = '/crm';

-- Comentário: Esta migração altera o nome do menu CRM para "Oportunidades"
-- mantendo a mesma funcionalidade e estrutura, apenas alterando a nomenclatura
-- para melhor refletir o propósito do módulo.