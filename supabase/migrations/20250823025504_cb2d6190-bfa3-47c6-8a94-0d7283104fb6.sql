-- Adicionar nova opção URGENTE ao enum de prioridade
ALTER TYPE ticket_priority ADD VALUE 'URGENTE' BEFORE 'ALTA';