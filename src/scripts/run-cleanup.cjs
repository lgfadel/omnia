#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configurações
const SRC_DIR = path.join(__dirname, '..');
const EXTENSIONS = ['.ts', '.tsx'];
const EXCLUDE_DIRS = ['node_modules', '.git', 'dist', 'build'];
const EXCLUDE_FILES = ['logging.ts', 'performance-check.js', 'run-cleanup.js'];

// Contadores
let filesProcessed = 0;
let consolesReplaced = 0;
let importsAdded = 0;

/**
 * Verifica se o arquivo deve ser processado
 */
function shouldProcessFile(filePath) {
  const fileName = path.basename(filePath);
  const ext = path.extname(filePath);
  
  // Verifica extensão
  if (!EXTENSIONS.includes(ext)) return false;
  
  // Verifica arquivos excluídos
  if (EXCLUDE_FILES.includes(fileName)) return false;
  
  // Verifica diretórios excluídos
  for (const excludeDir of EXCLUDE_DIRS) {
    if (filePath.includes(excludeDir)) return false;
  }
  
  return true;
}

/**
 * Obtém todos os arquivos TypeScript/React recursivamente
 */
function getAllFiles(dir) {
  const files = [];
  
  function traverse(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Pula diretórios excluídos
        if (!EXCLUDE_DIRS.includes(item)) {
          traverse(fullPath);
        }
      } else if (shouldProcessFile(fullPath)) {
        files.push(fullPath);
      }
    }
  }
  
  traverse(dir);
  return files;
}

/**
 * Verifica se o arquivo já tem import do logger
 */
function hasLoggerImport(content) {
  return content.includes("import { logger }") || 
         content.includes("from '../lib/logging'") ||
         content.includes("from '../../lib/logging'") ||
         content.includes("from '../../../lib/logging'") ||
         content.includes("from '../../../../lib/logging'");
}

/**
 * Adiciona import do logger no início do arquivo
 */
function addLoggerImport(content, filePath) {
  // Calcula o caminho relativo para logging.ts
  const relativePath = path.relative(path.dirname(filePath), path.join(SRC_DIR, 'lib', 'logging.ts'));
  const importPath = relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
  const normalizedPath = importPath.replace(/\\/g, '/').replace('.ts', '');
  
  const importStatement = `import { logger } from '${normalizedPath}';\n`;
  
  // Encontra onde inserir o import (após outros imports)
  const lines = content.split('\n');
  let insertIndex = 0;
  
  // Procura pelo último import
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('import ') || lines[i].trim().startsWith('export ')) {
      insertIndex = i + 1;
    } else if (lines[i].trim() === '' && insertIndex > 0) {
      // Linha vazia após imports
      break;
    } else if (lines[i].trim() !== '' && !lines[i].trim().startsWith('//') && insertIndex > 0) {
      // Primeira linha de código
      break;
    }
  }
  
  // Insere o import
  lines.splice(insertIndex, 0, importStatement);
  return lines.join('\n');
}

/**
 * Substitui console.log por logger.debug
 */
function replaceConsoleLogs(content) {
  let modified = content;
  let replacements = 0;
  
  // Padrões para substituição
  const patterns = [
    {
      regex: /console\.log\(/g,
      replacement: 'logger.debug(',
      type: 'debug'
    },
    {
      regex: /console\.error\(/g,
      replacement: 'logger.error(',
      type: 'error'
    },
    {
      regex: /console\.warn\(/g,
      replacement: 'logger.warn(',
      type: 'warn'
    },
    {
      regex: /console\.info\(/g,
      replacement: 'logger.info(',
      type: 'info'
    }
  ];
  
  for (const pattern of patterns) {
    const matches = modified.match(pattern.regex);
    if (matches) {
      replacements += matches.length;
      modified = modified.replace(pattern.regex, pattern.replacement);
    }
  }
  
  return { content: modified, replacements };
}

/**
 * Processa um arquivo individual
 */
function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let modified = content;
    let needsImport = false;
    
    // Verifica se há console.log para substituir
    const hasConsole = /console\.(log|error|warn|info)\(/.test(content);
    if (!hasConsole) {
      return { processed: false, replacements: 0, importAdded: false };
    }
    
    // Substitui console.log
    const { content: newContent, replacements } = replaceConsoleLogs(modified);
    modified = newContent;
    
    // Adiciona import se necessário
    if (replacements > 0 && !hasLoggerImport(modified)) {
      modified = addLoggerImport(modified, filePath);
      needsImport = true;
    }
    
    // Salva o arquivo se houve modificações
    if (replacements > 0) {
      fs.writeFileSync(filePath, modified, 'utf8');
    }
    
    return {
      processed: replacements > 0,
      replacements,
      importAdded: needsImport
    };
    
  } catch (error) {
    console.error(`❌ Erro ao processar ${filePath}:`, error.message);
    return { processed: false, replacements: 0, importAdded: false };
  }
}

/**
 * Função principal
 */
function main() {
  console.log('🧹 Iniciando limpeza de console.log...\n');
  
  const files = getAllFiles(SRC_DIR);
  console.log(`📁 Encontrados ${files.length} arquivos para processar\n`);
  
  for (const filePath of files) {
    const relativePath = path.relative(SRC_DIR, filePath);
    const result = processFile(filePath);
    
    if (result.processed) {
      filesProcessed++;
      consolesReplaced += result.replacements;
      if (result.importAdded) importsAdded++;
      
      console.log(`✅ ${relativePath} - ${result.replacements} substituições${result.importAdded ? ' + import' : ''}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMO DA LIMPEZA:');
  console.log(`📁 Arquivos processados: ${filesProcessed}`);
  console.log(`🔄 Console.log substituídos: ${consolesReplaced}`);
  console.log(`📦 Imports adicionados: ${importsAdded}`);
  
  if (filesProcessed === 0) {
    console.log('\n✨ Nenhum console.log encontrado! Código já está limpo.');
  } else {
    console.log('\n✨ Limpeza concluída com sucesso!');
  }
}

// Executa o script
if (require.main === module) {
  main();
}

module.exports = { main };