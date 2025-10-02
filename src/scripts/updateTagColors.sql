-- Script SQL para atualizar cores das tags com a nova paleta expandida
-- Execute este script diretamente no banco de dados PostgreSQL
-- 
-- IMPORTANTE: Este script redistribui cores de forma determinística
-- baseada no nome da tag para garantir consistência

-- Paleta de cores expandida (102 cores distintas)
WITH color_palette AS (
  SELECT unnest(ARRAY[
    -- Red family (300, 400, 500, 600, 700, 800)
    '#fca5a5', '#f87171', '#ef4444', '#dc2626', '#b91c1c', '#991b1b',
    -- Orange family
    '#fdba74', '#fb923c', '#f97316', '#ea580c', '#c2410c', '#9a3412',
    -- Amber family
    '#fcd34d', '#fbbf24', '#f59e0b', '#d97706', '#b45309', '#92400e',
    -- Yellow family
    '#fde047', '#facc15', '#eab308', '#ca8a04', '#a16207', '#854d0e',
    -- Lime family
    '#bef264', '#a3e635', '#84cc16', '#65a30d', '#4d7c0f', '#365314',
    -- Green family
    '#86efac', '#4ade80', '#22c55e', '#16a34a', '#15803d', '#14532d',
    -- Emerald family
    '#6ee7b7', '#34d399', '#10b981', '#059669', '#047857', '#064e3b',
    -- Teal family
    '#5eead4', '#2dd4bf', '#14b8a6', '#0d9488', '#0f766e', '#134e4a',
    -- Cyan family
    '#67e8f9', '#22d3ee', '#06b6d4', '#0891b2', '#0e7490', '#164e63',
    -- Sky family
    '#7dd3fc', '#38bdf8', '#0ea5e9', '#0284c7', '#0369a1', '#075985',
    -- Blue family
    '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af',
    -- Indigo family
    '#a5b4fc', '#818cf8', '#6366f1', '#4f46e5', '#4338ca', '#3730a3',
    -- Violet family
    '#c4b5fd', '#a78bfa', '#8b5cf6', '#7c3aed', '#6d28d9', '#5b21b6',
    -- Purple family
    '#d8b4fe', '#c084fc', '#a855f7', '#9333ea', '#7e22ce', '#6b21a8',
    -- Fuchsia family
    '#f0abfc', '#e879f9', '#d946ef', '#c026d3', '#a21caf', '#86198f',
    -- Pink family
    '#f9a8d4', '#f472b6', '#ec4899', '#db2777', '#be185d', '#9d174d',
    -- Rose family
    '#fda4af', '#fb7185', '#f43f5e', '#e11d48', '#be123c', '#9f1239'
  ]) AS color, 
  row_number() OVER () AS color_index
),
-- Obter todas as tags ordenadas por nome para distribuição determinística
tags_ordered AS (
  SELECT 
    id,
    name,
    color as current_color,
    row_number() OVER (ORDER BY name) AS tag_order
  FROM omnia_tags
),
-- Calcular nova cor para cada tag
tags_with_new_colors AS (
  SELECT 
    t.id,
    t.name,
    t.current_color,
    COALESCE(
      cp.color,
      -- Se não houver cor na paleta, gerar cor HSL determinística
      'hsl(' || 
      (((ascii(substring(t.name, 1, 1)) * 7 + ascii(substring(t.name, 2, 1)) * 11) % 360)) || 
      ', 65%, 55%)'
    ) AS new_color
  FROM tags_ordered t
  LEFT JOIN color_palette cp ON cp.color_index = ((t.tag_order - 1) % 102) + 1
)

-- Atualizar as tags com as novas cores
UPDATE omnia_tags 
SET 
  color = twnc.new_color,
  updated_at = NOW()
FROM tags_with_new_colors twnc
WHERE omnia_tags.id = twnc.id
  AND omnia_tags.color != twnc.new_color; -- Só atualiza se a cor for diferente

-- Verificar resultado
SELECT 
  'Atualização concluída!' as status,
  COUNT(*) as total_tags,
  COUNT(DISTINCT color) as cores_unicas
FROM omnia_tags;

-- Verificar se há cores duplicadas (deve retornar 0)
SELECT 
  color,
  COUNT(*) as quantidade,
  string_agg(name, ', ') as tags_com_esta_cor
FROM omnia_tags
GROUP BY color
HAVING COUNT(*) > 1
ORDER BY quantidade DESC;