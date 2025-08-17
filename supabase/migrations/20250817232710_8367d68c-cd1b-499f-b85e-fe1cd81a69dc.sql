-- Adicionar coluna color na tabela omnia_users
ALTER TABLE public.omnia_users 
ADD COLUMN color TEXT DEFAULT '#6366f1';

-- Função para gerar cor baseada no ID do usuário
CREATE OR REPLACE FUNCTION public.generate_user_color(user_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $function$
DECLARE
  colors TEXT[] := ARRAY[
    '#ef4444', '#f97316', '#eab308', '#22c55e', 
    '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
    '#d946ef', '#ec4899', '#f43f5e', '#84cc16',
    '#10b981', '#0ea5e9', '#6366f1', '#7c3aed'
  ];
  hash_value BIGINT;
  color_index INT;
BEGIN
  -- Gerar hash simples baseado no user_id
  hash_value := abs(hashtext(user_id));
  color_index := (hash_value % array_length(colors, 1)) + 1;
  
  RETURN colors[color_index];
END;
$function$;

-- Atualizar usuários existentes com cores geradas
UPDATE public.omnia_users 
SET color = public.generate_user_color(id::TEXT)
WHERE color = '#6366f1' OR color IS NULL;