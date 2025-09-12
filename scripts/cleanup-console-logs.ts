/**
 * Script to clean up console.log statements from production code
 * This script replaces console.log with logger.debug from our logging system
 */

import fs from 'fs'
import path from 'path'
import { glob } from 'glob'

const SRC_DIR = 'src'

// Files to process (exclude logging.ts itself)
const patterns = [
  `${SRC_DIR}/**/*.ts`,
  `${SRC_DIR}/**/*.tsx`,
  '!src/lib/logging.ts',
  '!src/**/*.test.ts',
  '!src/**/*.test.tsx'
]

// Regex to match console.log statements
const CONSOLE_LOG_REGEX = /console\.log\(/g
const CONSOLE_ERROR_REGEX = /console\.error\(/g
const CONSOLE_WARN_REGEX = /console\.warn\(/g

async function cleanupFile(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf-8')
  
  // Check if file has console statements
  if (!content.match(/console\.(log|error|warn)\(/)) {
    return false
  }

  let newContent = content
  let hasChanges = false

  // Replace console.log with logger.debug
  if (newContent.match(CONSOLE_LOG_REGEX)) {
    newContent = newContent.replace(CONSOLE_LOG_REGEX, 'logger.debug(')
    hasChanges = true
  }

  // Replace console.error with logger.error
  if (newContent.match(CONSOLE_ERROR_REGEX)) {
    newContent = newContent.replace(CONSOLE_ERROR_REGEX, 'logger.error(')
    hasChanges = true
  }

  // Replace console.warn with logger.warn
  if (newContent.match(CONSOLE_WARN_REGEX)) {
    newContent = newContent.replace(CONSOLE_WARN_REGEX, 'logger.warn(')
    hasChanges = true
  }

  // Add logger import if needed and has changes
  if (hasChanges && !content.includes("import { logger } from '@/lib/logging'")) {
    // Find the last import statement
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
    console.log(`✓ Cleaned up: ${filePath}`)
    return true
  }

  return false
}

async function main() {
  console.log('🧹 Starting console.log cleanup...\n')
  
  const files = await glob(patterns)
  let processedCount = 0
  let changedCount = 0

  for (const file of files) {
    processedCount++
    const changed = await cleanupFile(file)
    if (changed) {
      changedCount++
    }
  }

  console.log(`\n✨ Cleanup complete!`)
  console.log(`📊 Processed: ${processedCount} files`)
  console.log(`🔧 Modified: ${changedCount} files`)
  console.log(`🎯 Console.log statements replaced with logger.debug()`)
}

if (require.main === module) {
  main().catch(console.error)
}