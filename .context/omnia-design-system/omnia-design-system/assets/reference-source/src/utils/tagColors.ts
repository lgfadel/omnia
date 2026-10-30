import { logger } from '../lib/logging';

// Paleta expandida de cores para tags - cores vibrantes e distintas
// Agora com 102 cores diferentes para maior variedade
export const TAG_COLOR_PALETTE = [
  // Família Red (6 variações)
  '#fca5a5', // red-300
  '#f87171', // red-400
  '#ef4444', // red-500
  '#dc2626', // red-600
  '#b91c1c', // red-700
  '#991b1b', // red-800

  // Família Orange (6 variações)
  '#fdba74', // orange-300
  '#fb923c', // orange-400
  '#f97316', // orange-500
  '#ea580c', // orange-600
  '#c2410c', // orange-700
  '#9a3412', // orange-800

  // Família Amber (6 variações)
  '#fcd34d', // amber-300
  '#fbbf24', // amber-400
  '#f59e0b', // amber-500
  '#d97706', // amber-600
  '#b45309', // amber-700
  '#92400e', // amber-800

  // Família Yellow (6 variações)
  '#fde047', // yellow-300
  '#facc15', // yellow-400
  '#eab308', // yellow-500
  '#ca8a04', // yellow-600
  '#a16207', // yellow-700
  '#854d0e', // yellow-800

  // Família Lime (6 variações)
  '#bef264', // lime-300
  '#a3e635', // lime-400
  '#84cc16', // lime-500
  '#65a30d', // lime-600
  '#4d7c0f', // lime-700
  '#365314', // lime-800

  // Família Green (6 variações)
  '#86efac', // green-300
  '#4ade80', // green-400
  '#22c55e', // green-500
  '#16a34a', // green-600
  '#15803d', // green-700
  '#166534', // green-800

  // Família Emerald (6 variações)
  '#6ee7b7', // emerald-300
  '#34d399', // emerald-400
  '#10b981', // emerald-500
  '#059669', // emerald-600
  '#047857', // emerald-700
  '#065f46', // emerald-800

  // Família Teal (6 variações)
  '#5eead4', // teal-300
  '#2dd4bf', // teal-400
  '#14b8a6', // teal-500
  '#0d9488', // teal-600
  '#0f766e', // teal-700
  '#134e4a', // teal-800

  // Família Cyan (6 variações)
  '#67e8f9', // cyan-300
  '#22d3ee', // cyan-400
  '#06b6d4', // cyan-500
  '#0891b2', // cyan-600
  '#0e7490', // cyan-700
  '#155e75', // cyan-800

  // Família Sky (6 variações)
  '#7dd3fc', // sky-300
  '#38bdf8', // sky-400
  '#0ea5e9', // sky-500
  '#0284c7', // sky-600
  '#0369a1', // sky-700
  '#0c4a6e', // sky-800

  // Família Blue (6 variações)
  '#93c5fd', // blue-300
  '#60a5fa', // blue-400
  '#3b82f6', // blue-500
  '#2563eb', // blue-600
  '#1d4ed8', // blue-700
  '#1e40af', // blue-800

  // Família Indigo (6 variações)
  '#a5b4fc', // indigo-300
  '#818cf8', // indigo-400
  '#6366f1', // indigo-500
  '#4f46e5', // indigo-600
  '#3730a3', // indigo-700
  '#312e81', // indigo-800

  // Família Violet (6 variações)
  '#c4b5fd', // violet-300
  '#a78bfa', // violet-400
  '#8b5cf6', // violet-500
  '#7c3aed', // violet-600
  '#6d28d9', // violet-700
  '#5b21b6', // violet-800

  // Família Purple (6 variações)
  '#c084fc', // purple-300
  '#a855f7', // purple-400
  '#9333ea', // purple-500
  '#7e22ce', // purple-600
  '#6b21a8', // purple-700
  '#581c87', // purple-800

  // Família Fuchsia (6 variações)
  '#f0abfc', // fuchsia-300
  '#e879f9', // fuchsia-400
  '#d946ef', // fuchsia-500
  '#c026d3', // fuchsia-600
  '#a21caf', // fuchsia-700
  '#86198f', // fuchsia-800

  // Família Pink (6 variações)
  '#f9a8d4', // pink-300
  '#f472b6', // pink-400
  '#ec4899', // pink-500
  '#db2777', // pink-600
  '#be185d', // pink-700
  '#9d174d', // pink-800

  // Família Rose (6 variações)
  '#fda4af', // rose-300
  '#fb7185', // rose-400
  '#f43f5e', // rose-500
  '#e11d48', // rose-600
  '#be123c', // rose-700
  '#9f1239', // rose-800
];

/**
 * Converte HSL para HEX para consistência
 */
function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Gera cores HSL distintas usando distribuição uniforme
 */
function generateDistinctHSLColors(count: number, usedColors: string[] = []): string[] {
  const colors: string[] = [];
  const hueStep = 360 / count; // Distribuir matizes uniformemente
  const saturations = [70, 80, 90]; // Variações de saturação
  const lightnesses = [45, 55, 65]; // Variações de luminosidade
  
  let hue = Math.floor(Math.random() * 360); // Começar de um ponto aleatório
  
  for (let i = 0; i < count; i++) {
    let attempts = 0;
    let newColor: string;
    
    do {
      const saturation = saturations[i % saturations.length];
      const lightness = lightnesses[Math.floor(i / saturations.length) % lightnesses.length];
      newColor = hslToHex(hue, saturation, lightness);
      hue = (hue + hueStep) % 360;
      attempts++;
    } while (usedColors.includes(newColor) && attempts < 10);
    
    colors.push(newColor);
  }
  
  return colors;
}

/**
 * Gera uma cor única para uma tag, evitando cores já utilizadas
 * @param usedColors Array de cores já utilizadas
 * @returns Cor única em formato hexadecimal
 */
export function generateUniqueTagColor(usedColors: string[] = []): string {
  logger.debug('🎨 generateUniqueTagColor: Called with usedColors:', { count: usedColors.length });
  logger.debug('🎨 generateUniqueTagColor: Total palette colors:', { total: TAG_COLOR_PALETTE.length });
  
  // Filtrar cores disponíveis (que não estão sendo usadas)
  const availableColors = TAG_COLOR_PALETTE.filter(color => !usedColors.includes(color));
  logger.debug('🎨 generateUniqueTagColor: Available colors count:', { count: availableColors.length });
  
  // Se ainda há cores disponíveis na paleta, usar uma delas
  if (availableColors.length > 0) {
    const randomIndex = Math.floor(Math.random() * availableColors.length);
    const selectedColor = availableColors[randomIndex];
    logger.debug('🎨 generateUniqueTagColor: Selected color from palette:', { color: selectedColor });
    return selectedColor;
  }
  
  // Se todas as cores da paleta foram usadas, gerar cores HSL distintas
  logger.debug('🎨 generateUniqueTagColor: All palette colors used, generating distinct HSL color...');
  const distinctColors = generateDistinctHSLColors(1, usedColors);
  const generatedColor = distinctColors[0];
  
  logger.debug('🎨 generateUniqueTagColor: Generated distinct color:', { color: generatedColor });
  return generatedColor;
}

/**
 * Gera cores únicas para um array de nomes de tags
 * @param tagNames Array de nomes de tags
 * @param existingColors Mapa de cores já existentes (nome -> cor)
 * @returns Mapa com nome da tag e sua cor única
 */
export function generateUniqueColorsForTags(
  tagNames: string[], 
  existingColors: Record<string, string> = {}
): Record<string, string> {
  const result: Record<string, string> = { ...existingColors };
  const usedColors = Object.values(existingColors);
  
  for (const tagName of tagNames) {
    if (!result[tagName]) {
      const newColor = generateUniqueTagColor(usedColors);
      result[tagName] = newColor;
      usedColors.push(newColor);
    }
  }
  
  return result;
}

/**
 * Embaralha um array usando o algoritmo Fisher-Yates
 * @param array Array para embaralhar
 * @returns Array embaralhado
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Distribui cores de forma mais equilibrada para um conjunto de tags
 * @param tagNames Array de nomes de tags
 * @returns Mapa com nome da tag e sua cor única
 */
export function distributeColorsForTags(tagNames: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  const shuffledColors = shuffleArray(TAG_COLOR_PALETTE);
  
  tagNames.forEach((tagName, index) => {
    if (index < shuffledColors.length) {
      result[tagName] = shuffledColors[index];
    } else {
      // Se há mais tags que cores na paleta, gera cores HSL aleatórias
      const hue = Math.floor(Math.random() * 360);
      const saturation = 60 + Math.floor(Math.random() * 30);
      const lightness = 45 + Math.floor(Math.random() * 20);
      result[tagName] = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    }
  });
  
  return result;
}