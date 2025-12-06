/**
 * Script para atualizar todas as tags existentes com cores aleatórias exclusivas
 * 
 * INSTRUÇÕES PARA EXECUÇÃO:
 * 1. Certifique-se de que o servidor de desenvolvimento está rodando
 * 2. Execute este script através do console do navegador ou via Node.js
 * 3. O script irá buscar todas as tags existentes e atribuir cores únicas
 */

import { supabase } from '@/integrations/supabase/client';
import { distributeColorsForTags } from '@/utils/tagColors';
import { logger } from '@/lib/logging';

interface TagFromDB {
  id: string;
  name: string;
  color: string;
  created_at: string;
  created_by?: string;
  updated_at: string;
}

/**
 * Busca todas as tags existentes no banco de dados
 */
async function getAllTags(): Promise<TagFromDB[]> {
  logger.info('Buscando todas as tags existentes...');
  
  const { data, error } = await supabase
    .from('omnia_tags')
    .select('*')
    .order('name');

  if (error) {
    logger.error('Erro ao buscar tags:', error);
    throw error;
  }

  logger.info(`Encontradas ${data?.length || 0} tags`);
  return data || [];
}

/**
 * Atualiza uma tag com nova cor
 */
async function updateTagColor(tagId: string, newColor: string): Promise<boolean> {
  const { error } = await supabase
    .from('omnia_tags')
    .update({ 
      color: newColor,
      updated_at: new Date().toISOString()
    })
    .eq('id', tagId);

  if (error) {
    logger.error(`Erro ao atualizar tag ${tagId}:`, error);
    return false;
  }

  return true;
}

/**
 * Função principal para atualizar cores das tags
 */
export async function updateAllTagColors(): Promise<void> {
  try {
    logger.info('🎨 Iniciando atualização de cores das tags...');

    // 1. Buscar todas as tags existentes
    const existingTags = await getAllTags();
    
    if (existingTags.length === 0) {
      logger.info('Nenhuma tag encontrada para atualizar.');
      return;
    }

    // 2. Gerar cores únicas para todas as tags
    const tagNames = existingTags.map(tag => tag.name);
    const colorMap = distributeColorsForTags(tagNames);

    logger.info('Cores geradas:', colorMap);

    // 3. Atualizar cada tag com sua nova cor
    let successCount = 0;
    let errorCount = 0;

    for (const tag of existingTags) {
      const newColor = colorMap[tag.name];
      
      if (newColor && newColor !== tag.color) {
        logger.info(`Atualizando tag "${tag.name}" de ${tag.color} para ${newColor}`);
        
        const success = await updateTagColor(tag.id, newColor);
        
        if (success) {
          successCount++;
          logger.info(`✅ Tag "${tag.name}" atualizada com sucesso`);
        } else {
          errorCount++;
          logger.error(`❌ Falha ao atualizar tag "${tag.name}"`);
        }
      } else {
        logger.info(`Tag "${tag.name}" já possui cor adequada: ${tag.color}`);
      }
    }

    // 4. Relatório final
    logger.info('🎨 Atualização de cores concluída!');
    logger.info(`✅ Tags atualizadas com sucesso: ${successCount}`);
    logger.info(`❌ Tags com erro: ${errorCount}`);
    logger.info(`📊 Total de tags processadas: ${existingTags.length}`);

  } catch (error) {
    logger.error('Erro durante a atualização de cores das tags:', error);
    throw error;
  }
}

/**
 * Função para verificar se há cores duplicadas
 */
export async function checkForDuplicateColors(): Promise<void> {
  try {
    const tags = await getAllTags();
    const colorCounts: Record<string, string[]> = {};

    tags.forEach(tag => {
      if (!colorCounts[tag.color]) {
        colorCounts[tag.color] = [];
      }
      colorCounts[tag.color].push(tag.name);
    });

    const duplicates = Object.entries(colorCounts).filter(([_, names]) => names.length > 1);

    if (duplicates.length > 0) {
      logger.warn('🚨 Cores duplicadas encontradas:');
      duplicates.forEach(([color, names]) => {
        logger.warn(`Cor ${color}: ${names.join(', ')}`);
      });
    } else {
      logger.info('✅ Nenhuma cor duplicada encontrada!');
    }

  } catch (error) {
    logger.error('Erro ao verificar cores duplicadas:', error);
  }
}

// Para execução direta no console do navegador
if (typeof window !== 'undefined') {
  (window as any).updateAllTagColors = updateAllTagColors;
  (window as any).checkForDuplicateColors = checkForDuplicateColors;
  
  console.log('🎨 Script de atualização de cores das tags carregado!');
  console.log('Execute: updateAllTagColors() para atualizar todas as tags');
  console.log('Execute: checkForDuplicateColors() para verificar duplicatas');
}