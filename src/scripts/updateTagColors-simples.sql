-- Script SIMPLES para atualizar cores das tags dos condomínios
-- Execute tudo de uma vez no Supabase SQL Editor

-- Atualizar cores específicas para cada condomínio
UPDATE omnia_tags SET color = '#ef4444', updated_at = NOW() WHERE name = 'Água da Prata';
UPDATE omnia_tags SET color = '#f97316', updated_at = NOW() WHERE name = 'Solar Mirador';
UPDATE omnia_tags SET color = '#eab308', updated_at = NOW() WHERE name = 'Euro';
UPDATE omnia_tags SET color = '#22c55e', updated_at = NOW() WHERE name = 'Buenos Ayres';
UPDATE omnia_tags SET color = '#3b82f6', updated_at = NOW() WHERE name = 'Felicita';
UPDATE omnia_tags SET color = '#8b5cf6', updated_at = NOW() WHERE name = 'La Fenice';
UPDATE omnia_tags SET color = '#ec4899', updated_at = NOW() WHERE name = 'Queens';
UPDATE omnia_tags SET color = '#14b8a6', updated_at = NOW() WHERE name = 'Odyssey';
UPDATE omnia_tags SET color = '#f59e0b', updated_at = NOW() WHERE name = 'Olga';
UPDATE omnia_tags SET color = '#84cc16', updated_at = NOW() WHERE name = 'Eleição';
UPDATE omnia_tags SET color = '#06b6d4', updated_at = NOW() WHERE name = 'Liberty';
UPDATE omnia_tags SET color = '#6366f1', updated_at = NOW() WHERE name = 'Santa Rita III';
UPDATE omnia_tags SET color = '#10b981', updated_at = NOW() WHERE name = 'Bella Coimbra';
UPDATE omnia_tags SET color = '#f43f5e', updated_at = NOW() WHERE name = 'WhatsApp';
UPDATE omnia_tags SET color = '#7c3aed', updated_at = NOW() WHERE name = 'Golden Park Residence';
UPDATE omnia_tags SET color = '#dc2626', updated_at = NOW() WHERE name = 'Eventos';
UPDATE omnia_tags SET color = '#059669', updated_at = NOW() WHERE name = 'Maanaim';
UPDATE omnia_tags SET color = '#0891b2', updated_at = NOW() WHERE name = 'Malote';
UPDATE omnia_tags SET color = '#65a30d', updated_at = NOW() WHERE name = 'Cantares';
UPDATE omnia_tags SET color = '#9333ea', updated_at = NOW() WHERE name = 'Araçari';
UPDATE omnia_tags SET color = '#0d9488', updated_at = NOW() WHERE name = 'Champs Elysees';
UPDATE omnia_tags SET color = '#ca8a04', updated_at = NOW() WHERE name = 'Casa Batllo';
UPDATE omnia_tags SET color = '#be185d', updated_at = NOW() WHERE name = 'Epic';
UPDATE omnia_tags SET color = '#1d4ed8', updated_at = NOW() WHERE name = 'VanGogh';
UPDATE omnia_tags SET color = '#4338ca', updated_at = NOW() WHERE name = 'Petit Ville';
UPDATE omnia_tags SET color = '#16a34a', updated_at = NOW() WHERE name = 'Casa Versage';
UPDATE omnia_tags SET color = '#7e22ce', updated_at = NOW() WHERE name = 'Comercial';
UPDATE omnia_tags SET color = '#15803d', updated_at = NOW() WHERE name = 'Campinas';
UPDATE omnia_tags SET color = '#0f766e', updated_at = NOW() WHERE name = 'Heimtal Park';

-- Verificar resultado
SELECT 
    'Atualização concluída!' as status,
    COUNT(*) as total_tags,
    COUNT(DISTINCT color) as cores_unicas
FROM omnia_tags;

-- Mostrar todas as tags com suas novas cores
SELECT name, color FROM omnia_tags ORDER BY name;