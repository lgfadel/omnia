#!/usr/bin/env node

/**
 * Executa limpeza automática de console.log nos arquivos do projeto
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const glob = require('glob')

const SRC_DIR = 'src'

// Padrões de arquivo para processar
const patterns = [
  `${SRC_DIR}/**/*.ts`,
  `${SRC_DIR}/**/*.tsx`,
  '!src/lib/logging.ts',
  '!src/**/*.test.ts',
  '!src/**/*.test.tsx'
]

// Regex para encontrar console statements
const CONSOLE_LOG_REGEX = /console\.log\(/g
const CONSOLE_ERROR_REGEX = /console\.error\(/g
const CONSOLE_WARN_REGEX = /console\.warn\(/g

function cleanupFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  
  // Verifica se tem console statements
  if (!content.match(/console\.(log|error|warn)\(/)) {
    return false
  }

  let newContent = content
  let hasChanges = false

  // Substitui console.log por logger.debug
  if (newContent.match(CONSOLE_LOG_REGEX)) {
    newContent = newContent.replace(CONSOLE_LOG_REGEX, 'logger.debug(')
    hasChanges = true
  }

  // Substitui console.error por logger.error
  if (newContent.match(CONSOLE_ERROR_REGEX)) {
    newContent = newContent.replace(CONSOLE_ERROR_REGEX, 'logger.error(')
    hasChanges = true
  }

  // Substitui console.warn por logger.warn
  if (newContent.match(CONSOLE_WARN_REGEX)) {
    newContent = newContent.replace(CONSOLE_WARN_REGEX, 'logger.warn(')
    hasChanges = true
  }

  // Adiciona import do logger se necessário
  if (hasChanges && !content.includes("import { logger } from '@/lib/logging'")) {
    const lines = newContent.split('\n')
    let lastImportIndex = -1
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('import ')) {
        lastImportIndex = i
      }
    }

    if (lastImportIndex !== -1) {
      lines.splice(lastImportIndex + 1, 0, "import { logger } from '@/lib/logging'")
      newContent = lines.join('\n')
    }
  }

  if (hasChanges) {
    fs.writeFileSync(filePath, newContent, 'utf-8')
    console.log(`✓ Limpo: ${filePath}`)
    return true
  }

  return false
}

async function main() {
  console.log('🧹 Iniciando limpeza de console.log...\n')
  
  const files = glob.sync(patterns)
  let processedCount = 0
  let changedCount = 0

  for (const file of files) {
    processedCount++
    const changed = cleanupFile(file)
    if (changed) {
      changedCount++
    }
  }

  console.log(`\n✨ Limpeza concluída!`)
  console.log(`📊 Processados: ${processedCount} arquivos`)
  console.log(`🔧 Modificados: ${changedCount} arquivos`)
  console.log(`🎯 Statements console.* substituídos por logger.*`)
}

if (require.main === module) {
  main().catch(console.error)
}