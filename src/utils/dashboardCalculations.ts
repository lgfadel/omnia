import { Ata, Status } from '@/data/fixtures'
import { Tarefa } from '@/repositories/tarefasRepo.supabase'

// Tipos para as métricas do dashboard
export interface AtasMetrics {
  total: number
  distribuicaoPorStatus: { name: string; value: number; color: string }[]
  atasAtrasadas: number
  taxaConclusao: number
}

export interface TarefasMetrics {
  totalAtivas: number
  distribuicaoPorStatus: { name: string; value: number; color: string }[]
  distribuicaoPorPrioridade: { name: string; value: number; color: string }[]
  distribuicaoPorResponsavel: { name: string; value: number }[]
  tarefasVencidas: number
  tarefasNoPrazo: number
  taxaConclusao: number
}

// Cores para os gráficos
const STATUS_COLORS = {
  'Rascunho': '#94a3b8',
  'Em Análise': '#f59e0b',
  'Aprovada': '#10b981',
  'Rejeitada': '#ef4444',
  'Pendente': '#6b7280',
  'Em Andamento': '#3b82f6',
  'Concluída': '#10b981',
  'Cancelada': '#ef4444'
}

const PRIORITY_COLORS = {
  'URGENTE': '#ef4444', // red-500
  'ALTA': '#eab308',    // yellow-500
  'NORMAL': '#3b82f6',  // blue-500
  'BAIXA': '#6b7280',   // gray-500
  // Fallbacks para nomes em português
  'Alta': '#eab308',
  'Média': '#3b82f6',
  'Baixa': '#6b7280'
}

/**
 * Calcula métricas das atas
 */
export function calculateAtasMetrics(atas: Ata[], statuses: Status[]): AtasMetrics {
  console.log('calculateAtasMetrics - statuses disponíveis:', statuses.map(s => ({ id: s.id, name: s.name, color: s.color })))
  
  // Filtrar atas abertas (excluindo 'Concluído' e 'Aprovada')
  const atasAbertas = atas.filter(ata => {
    const status = statuses.find(s => s.id === ata.statusId)
    const statusName = status?.name || 'Desconhecido'
    return statusName !== 'Concluído' && statusName !== 'Aprovada'
  })
  
  const total = atasAbertas.length
  
  // Distribuição por status (apenas atas abertas)
  const statusCount = new Map<string, number>()
  atasAbertas.forEach(ata => {
    const status = statuses.find(s => s.id === ata.statusId)
    const statusName = status?.name || 'Desconhecido'
    statusCount.set(statusName, (statusCount.get(statusName) || 0) + 1)
  })
  
  const distribuicaoPorStatus = Array.from(statusCount.entries()).map(([name, value]) => {
    const status = statuses.find(s => s.name === name)
    const color = status?.color || STATUS_COLORS[name as keyof typeof STATUS_COLORS] || '#6b7280'
    console.log(`Status "${name}" - cor do banco: ${status?.color}, cor fallback: ${STATUS_COLORS[name as keyof typeof STATUS_COLORS]}, cor final: ${color}`)
    return {
      name,
      value,
      color
    }
  })
  
  // Atas atrasadas (atas abertas com mais de 15 dias da data da assembleia)
  const hoje = new Date()
  const atasAtrasadas = atasAbertas.filter(ata => {
    if (!ata.meetingDate) return false
    
    const dataAssembleia = new Date(ata.meetingDate)
    const diffTime = hoje.getTime() - dataAssembleia.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    return diffDays > 15
  }).length
  
  // Taxa de conclusão (atas aprovadas / total)
  const atasAprovadas = atas.filter(ata => {
    const status = statuses.find(s => s.id === ata.statusId)
    return status?.name === 'Aprovada'
  }).length
  
  const taxaConclusao = total > 0 ? Math.round((atasAprovadas / total) * 100) : 0
  
  return {
    total,
    distribuicaoPorStatus,
    atasAtrasadas,
    taxaConclusao
  }
}

/**
 * Calcula métricas das tarefas
 */
export function calculateTarefasMetrics(tarefas: Tarefa[], statuses: Status[]): TarefasMetrics {
  console.log('calculateTarefasMetrics - tarefas:', tarefas.map(t => ({ id: t.id, priority: t.priority, statusId: t.statusId })))
  console.log('calculateTarefasMetrics - statuses disponíveis:', statuses.map(s => ({ id: s.id, name: s.name, color: s.color })))
  
  // Filtrar apenas tarefas ativas (excluindo tarefas concluídas)
  const tarefasAtivas = tarefas.filter(tarefa => {
    const status = statuses.find(s => s.id === tarefa.statusId)
    const statusName = status?.name || ''
    // Excluir tarefas com status que indicam conclusão (baseado nos status padrão do sistema)
    const isActive = !['Resolvido', 'Fechado'].includes(statusName)
    return isActive
  })
  
  const totalAtivas = tarefasAtivas.length
  
  // Distribuição por status (apenas tarefas ativas)
  const statusCount = new Map<string, number>()
  tarefasAtivas.forEach(tarefa => {
    const status = statuses.find(s => s.id === tarefa.statusId)
    const statusName = status?.name || 'Desconhecido'
    statusCount.set(statusName, (statusCount.get(statusName) || 0) + 1)
  })
  
  const distribuicaoPorStatus = Array.from(statusCount.entries()).map(([name, value]) => {
    const status = statuses.find(s => s.name === name)
    const color = status?.color || STATUS_COLORS[name as keyof typeof STATUS_COLORS] || '#6b7280'
    console.log(`Tarefa Status "${name}" - cor do banco: ${status?.color}, cor fallback: ${STATUS_COLORS[name as keyof typeof STATUS_COLORS]}, cor final: ${color}`)
    return {
      name,
      value,
      color
    }
  })
  
  // Distribuição por prioridade (apenas tarefas ativas)
  const priorityCount = new Map<string, number>()
  tarefasAtivas.forEach(tarefa => {
    const priority = tarefa.priority || 'NORMAL'
    priorityCount.set(priority, (priorityCount.get(priority) || 0) + 1)
  })
  
  const distribuicaoPorPrioridade = Array.from(priorityCount.entries()).map(([name, value]) => {
    const color = PRIORITY_COLORS[name as keyof typeof PRIORITY_COLORS] || '#6b7280'
    console.log(`Prioridade "${name}" - cor: ${color}`)
    return {
      name,
      value,
      color
    }
  })
  
  // Distribuição por responsável (apenas tarefas ativas)
  const assigneeCount = new Map<string, number>()
  tarefasAtivas.forEach(tarefa => {
    const assignee = tarefa.assignedTo?.name || 'Não atribuído'
    assigneeCount.set(assignee, (assigneeCount.get(assignee) || 0) + 1)
  })
  
  const distribuicaoPorResponsavel = Array.from(assigneeCount.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10) // Top 10 responsáveis
  
  // Tarefas vencidas vs no prazo
  const hoje = new Date()
  let tarefasVencidas = 0
  let tarefasNoPrazo = 0
  
  tarefasAtivas.forEach(tarefa => {
    if (tarefa.dueDate) {
      const dataVencimento = new Date(tarefa.dueDate)
      if (dataVencimento < hoje) {
        tarefasVencidas++
      } else {
        tarefasNoPrazo++
      }
    } else {
      tarefasNoPrazo++ // Tarefas sem data de vencimento são consideradas no prazo
    }
  })
  
  // Taxa de conclusão (tarefas concluídas / total)
  const tarefasConcluidas = tarefas.filter(tarefa => {
    const status = statuses.find(s => s.id === tarefa.statusId)
    const statusName = status?.name || ''
    return ['Resolvido', 'Fechado'].includes(statusName)
  }).length
  const taxaConclusao = tarefas.length > 0 ? Math.round((tarefasConcluidas / tarefas.length) * 100) : 0
  
  return {
    totalAtivas,
    distribuicaoPorStatus,
    distribuicaoPorPrioridade,
    distribuicaoPorResponsavel,
    tarefasVencidas,
    tarefasNoPrazo,
    taxaConclusao
  }
}

/**
 * Formata números para exibição
 */
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}

/**
 * Formata porcentagem
 */
export function formatPercentage(num: number): string {
  return `${num}%`
}

/**
 * Calcula diferença em dias entre duas datas
 */
export function daysDifference(date1: Date, date2: Date): number {
  const diffTime = Math.abs(date2.getTime() - date1.getTime())
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * Verifica se uma data está vencida
 */
export function isOverdue(date: string | Date): boolean {
  const targetDate = typeof date === 'string' ? new Date(date) : date
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  targetDate.setHours(0, 0, 0, 0)
  return targetDate < today
}