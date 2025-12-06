#!/usr/bin/env node

/**
 * Script para verificar performance e potenciais otimizações
 */

const fs = require('fs')
const path = require('path')
const glob = require('glob')

const SRC_DIR = 'src'

function analyzeComponent(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const fileName = path.basename(filePath)
  
  const issues = []
  
  // Verifica se usa React.memo
  if (content.includes('export') && content.includes('function') && !content.includes('React.memo')) {
    issues.push('⚠️  Considera usar React.memo para otimização')
  }
  
  // Verifica console.log em produção
  if (content.includes('console.log(')) {
    const count = (content.match(/console\.log\(/g) || []).length
    issues.push(`🐛 ${count} console.log encontrados`)
  }
  
  // Verifica imports não utilizados (básico)
  const imports = content.match(/import\s+\{([^}]+)\}/g) || []
  imports.forEach(imp => {
    const importedItems = imp.match(/\{([^}]+)\}/)[1].split(',').map(item => item.trim())
    importedItems.forEach(item => {
      const cleanItem = item.split(' as ')[0].trim()
      if (!content.includes(cleanItem) || content.indexOf(cleanItem) === content.lastIndexOf(cleanItem)) {
        issues.push(`📦 Import possivelmente não utilizado: ${cleanItem}`)
      }
    })
  })
  
  // Verifica componentes grandes (mais de 200 linhas)
  const lineCount = content.split('\n').length
  if (lineCount > 200) {
    issues.push(`📏 Componente grande (${lineCount} linhas) - considera quebrar em componentes menores`)
  }
  
  return { fileName, issues, lineCount }
}

async function main() {
  console.log('🔍 Analisando performance dos componentes...\n')
  
  const files = glob.sync([
    `${SRC_DIR}/**/*.tsx`,
    `${SRC_DIR}/**/*.ts`,
    '!src/**/*.test.*'
  ])
  
  let totalIssues = 0
  let largeComponents = 0
  let consoleLogs = 0
  
  console.log('📊 RELATÓRIO DE PERFORMANCE\n')
  console.log('=' .repeat(50))
  
  for (const file of files) {
    const analysis = analyzeComponent(file)
    
    if (analysis.issues.length > 0) {
      console.log(`\n📁 ${analysis.fileName}`)
      analysis.issues.forEach(issue => {
        console.log(`   ${issue}`)
        totalIssues++
        
        if (issue.includes('console.log')) consoleLogs++
        if (issue.includes('grande')) largeComponents++
      })
    }
  }
  
  console.log('\n' + '='.repeat(50))
  console.log('📈 RESUMO:')
  console.log(`📊 Arquivos analisados: ${files.length}`)
  console.log(`⚠️  Total de issues: ${totalIssues}`)
  console.log(`🐛 Console.log encontrados: ${consoleLogs}`)
  console.log(`📏 Componentes grandes: ${largeComponents}`)
  
  if (totalIssues === 0) {
    console.log('\n✅ Parabéns! Nenhum problema de performance encontrado!')
  } else {
    console.log('\n💡 Execute o script de limpeza para resolver alguns issues automaticamente')
  }
}

if (require.main === module) {
  main().catch(console.error)
}