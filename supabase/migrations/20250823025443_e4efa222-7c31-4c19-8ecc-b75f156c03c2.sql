-- Adicionar nova opção URGENTE ao enum de prioridade
ALTER TYPE public.tarefa_prioridade ADD VALUE 'URGENTE' BEFORE 'ALTA';