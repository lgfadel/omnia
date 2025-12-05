// Utility functions for code cleanup and optimization

export function removeDeadCode(code: string): string {
  // Remove comentários TODO/FIXME desnecessários
  let cleanCode = code.replace(/\/\*\s*(TODO|FIXME|XXX).*?\*\//g, '')
  cleanCode = cleanCode.replace(/\/\/\s*(TODO|FIXME|XXX).*$/gm, '')
  
  // Remove imports não utilizados (básico)
  const lines = cleanCode.split('\n')
  const imports = lines.filter(line => line.trim().startsWith('import'))
  
  return cleanCode
}

export function optimizeImports(code: string): string {
  const lines = code.split('\n')
  const imports: string[] = []
  const otherLines: string[] = []
  
  lines.forEach(line => {
    if (line.trim().startsWith('import')) {
      imports.push(line)
    } else {
      otherLines.push(line)
    }
  })
  
  // Ordena imports: React primeiro, depois libs externas, depois internos
  const sortedImports = imports.sort((a, b) => {
    const getImportType = (imp: string) => {
      if (imp.includes('react')) return 0
      if (imp.includes('@/')) return 2
      return 1
    }
    
    return getImportType(a) - getImportType(b)
  })
  
  return [...sortedImports, '', ...otherLines].join('\n')
}

export function findUnusedExports(code: string, fileName: string): string[] {
  const exportMatches = code.match(/export\s+(?:const|function|class|interface|type)\s+(\w+)/g) || []
  const exportNames = exportMatches.map(match => {
    const nameMatch = match.match(/export\s+(?:const|function|class|interface|type)\s+(\w+)/)
    return nameMatch ? nameMatch[1] : ''
  }).filter(Boolean)
  
  // Esta é uma verificação básica - em um projeto real, seria necessário
  // analisar todas as importações em outros arquivos
  return exportNames.filter(name => {
    const usageCount = (code.match(new RegExp(`\\b${name}\\b`, 'g')) || []).length
    return usageCount <= 1 // Apenas a declaração
  })
}