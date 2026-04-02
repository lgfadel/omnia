import { Ata, Status, UserRef } from '@/data/types'
import { Admissao } from '@/repositories/admissoesRepo.supabase'
import { Balancete } from '@/repositories/balancetesRepo.supabase'
import { Condominium } from '@/repositories/condominiumsRepo.supabase'
import { Rescisao } from '@/repositories/rescisaoRepo.supabase'
import { TarefaStatus } from '@/repositories/tarefaStatusRepo.supabase'
import { Tarefa } from '@/repositories/tarefasRepo.supabase'
import {
  getBalanceteStatus,
  getBalanceteStatusLabel,
  type BalanceteStatusColor,
} from '@/lib/balanceteStatus'

export interface ChartDatum {
  name: string
  value: number
  color: string
}

export interface HighlightItem {
  id: string
  label: string
  value: number
  tone: 'critical' | 'attention' | 'healthy' | 'recent'
}

export interface OverviewMetrics {
  totalOpenItems: number
  totalCriticalItems: number
  totalOverdueItems: number
  completedLast30Days: number
  openByModule: Array<{ name: string; value: number; color: string }>
}

export interface AtasDashboardMetrics {
  open: number
  overdue: number
  approvedLast30Days: number
  statusDistribution: ChartDatum[]
  openItems: Array<{
    id: string
    title: string
    code?: string
    statusName: string
    statusColor: string
    responsibleName: string
    responsibleColor?: string
    meetingDate?: string
    isOperationallyOverdue: boolean
  }>
}

export interface TarefasDashboardMetrics {
  active: number
  overdue: number
  onTrack: number
  completedLast30Days: number
  statusDistribution: ChartDatum[]
  priorityDistribution: ChartDatum[]
  assigneeDistribution: Array<{ name: string; value: number }>
  openItems: Array<{
    id: string
    title: string
    priority: string
    tags: string[]
    statusName: string
    statusColor: string
    responsibleName: string
    responsibleColor?: string
    dueDate?: string
    isOverdue: boolean
    overdueDays?: number
  }>
}

export interface WorkflowDashboardMetrics {
  open: number
  overdue: number
  urgent: number
  completedLast30Days: number
  statusDistribution: ChartDatum[]
}

export interface BalancetesDashboardMetrics {
  onTrack: number
  attention: number
  overdue: number
  missing: number
  receivedLast30Days: number
  healthDistribution: ChartDatum[]
}

export interface DashboardMetrics {
  overview: OverviewMetrics
  atas: AtasDashboardMetrics
  tarefas: TarefasDashboardMetrics
  admissoes: WorkflowDashboardMetrics
  rescisoes: WorkflowDashboardMetrics
  balancetes: BalancetesDashboardMetrics
  highlights: HighlightItem[]
}

const DEFAULT_CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--healthy))',
  'hsl(var(--attention))',
  'hsl(var(--critical))',
  'hsl(var(--recent))',
  'hsl(var(--muted-foreground))',
]

const MODULE_COLORS = {
  Atas: 'hsl(var(--primary))',
  Tarefas: 'hsl(var(--recent))',
  Admissoes: 'hsl(var(--healthy))',
  Rescisoes: 'hsl(var(--critical))',
  Balancetes: 'hsl(var(--attention))',
}

const PRIORITY_COLORS: Record<string, string> = {
  URGENTE: 'hsl(var(--critical))',
  ALTA: 'hsl(var(--attention))',
  NORMAL: 'hsl(var(--recent))',
  BAIXA: 'hsl(var(--muted-foreground))',
  Alta: 'hsl(var(--attention))',
  'Média': 'hsl(var(--recent))',
  Baixa: 'hsl(var(--muted-foreground))',
}

const BALANCETE_COLORS: Record<BalanceteStatusColor, string> = {
  green: 'hsl(var(--healthy))',
  yellow: 'hsl(var(--attention))',
  red: 'hsl(var(--critical))',
  none: 'hsl(var(--muted-foreground))',
}

function normalizeStatusName(name?: string | null) {
  return (name || '').trim().toLowerCase()
}

function isCompletedStatusName(name?: string | null) {
  const normalized = normalizeStatusName(name)
  return normalized.includes('conclu') || normalized.includes('finalizad') || normalized.includes('aprovad')
}

function isOpenWorkflowStatusName(name?: string | null) {
  return !isCompletedStatusName(name)
}

function startOfToday() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

function isWithinLastDays(dateValue: Date | string | null | undefined, days: number) {
  if (!dateValue) return false
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue)
  if (Number.isNaN(date.getTime())) return false
  const now = new Date()
  const threshold = new Date(now)
  threshold.setDate(now.getDate() - days)
  return date >= threshold && date <= now
}

function isPastDue(dateValue: Date | string | null | undefined) {
  if (!dateValue) return false
  const date = dateValue instanceof Date ? new Date(dateValue) : new Date(dateValue)
  if (Number.isNaN(date.getTime())) return false
  const today = startOfToday()
  date.setHours(0, 0, 0, 0)
  return date < today
}

function countByName<T>(
  items: T[],
  getName: (item: T) => string,
  getColor?: (name: string, index: number) => string,
) {
  const counts = new Map<string, number>()

  items.forEach((item) => {
    const name = getName(item)
    counts.set(name, (counts.get(name) || 0) + 1)
  })

  return Array.from(counts.entries())
    .map(([name, value], index) => ({
      name,
      value,
      color: getColor?.(name, index) || DEFAULT_CHART_COLORS[index % DEFAULT_CHART_COLORS.length],
    }))
    .sort((a, b) => b.value - a.value)
}

function getStatusMap<T extends { id: string; name: string; color: string }>(statuses: T[]) {
  return new Map(statuses.map((status) => [status.id, status]))
}

function calculateAtasMetrics(atas: Ata[], statuses: Status[]): AtasDashboardMetrics {
  const statusMap = getStatusMap(statuses)
  const openAtas = atas.filter((ata) => isOpenWorkflowStatusName(statusMap.get(ata.statusId)?.name))
  const overdue = openAtas.filter((ata) => {
    if (!ata.meetingDate) return false
    const meetingDate = new Date(ata.meetingDate)
    if (Number.isNaN(meetingDate.getTime())) return false
    const diffMs = Date.now() - meetingDate.getTime()
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
    return diffDays > 15
  }).length

  const approvedLast30Days = atas.filter((ata) => {
    const status = statusMap.get(ata.statusId)
    return normalizeStatusName(status?.name).includes('aprovad') && isWithinLastDays(ata.updatedAt, 30)
  }).length

  const statusDistribution = countByName(
    openAtas,
    (ata) => statusMap.get(ata.statusId)?.name || 'Sem status',
    (name, index) => statusMap.get(Array.from(statusMap.values()).find((status) => status.name === name)?.id || '')?.color || DEFAULT_CHART_COLORS[index % DEFAULT_CHART_COLORS.length],
  )

  const openItems = openAtas.map((ata) => {
    const status = statusMap.get(ata.statusId)
    const meetingDate = ata.meetingDate
    let isOperationallyOverdue = false
    let overdueDays = 0

    if (meetingDate) {
      const date = new Date(meetingDate)
      if (!Number.isNaN(date.getTime())) {
        const diffMs = Date.now() - date.getTime()
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
        overdueDays = Math.max(diffDays, 0)
        isOperationallyOverdue = diffDays > 15
      }
    }

    return {
      id: ata.id,
      title: ata.title,
      code: ata.code,
      statusName: status?.name || 'Sem status',
      statusColor: status?.color || 'hsl(var(--muted-foreground))',
      responsibleName: ata.responsible?.name || 'Sem responsável',
      responsibleColor: ata.responsible?.color || 'hsl(var(--muted-foreground))',
      meetingDate,
      isOperationallyOverdue,
      overdueDays,
    }
  })

  return {
    open: openAtas.length,
    overdue,
    approvedLast30Days,
    statusDistribution,
    openItems,
  }
}

function calculateTarefasMetrics(tarefas: Tarefa[], statuses: Status[]): TarefasDashboardMetrics {
  const statusMap = getStatusMap(statuses)
  const activeTasks = tarefas.filter((tarefa) => isOpenWorkflowStatusName(statusMap.get(tarefa.statusId)?.name))
  const overdue = activeTasks.filter((tarefa) => isPastDue(tarefa.dueDate)).length
  const onTrack = Math.max(activeTasks.length - overdue, 0)
  const completedLast30Days = tarefas.filter((tarefa) => {
    const status = statusMap.get(tarefa.statusId)
    return isCompletedStatusName(status?.name) && isWithinLastDays(tarefa.updatedAt, 30)
  }).length

  const priorityDistribution = countByName(
    activeTasks,
    (tarefa) => tarefa.priority || 'NORMAL',
    (name) => PRIORITY_COLORS[name] || 'hsl(var(--recent))',
  )

  const statusDistribution = countByName(
    activeTasks,
    (tarefa) => statusMap.get(tarefa.statusId)?.name || 'Sem status',
    (name, index) =>
      statusMap.get(Array.from(statusMap.values()).find((status) => status.name === name)?.id || '')?.color ||
      DEFAULT_CHART_COLORS[index % DEFAULT_CHART_COLORS.length],
  )

  const assigneeDistribution = countByName(
    activeTasks,
    (tarefa) => tarefa.assignedTo?.name || 'Não atribuído',
    () => 'hsl(var(--recent))',
  )
    .map(({ name, value }) => ({ name, value }))
    .slice(0, 8)

  const openItems = activeTasks.map((tarefa) => {
    const dueDate = tarefa.dueDate instanceof Date ? tarefa.dueDate : undefined
    let isOverdue = false
    let overdueDays = 0

    if (dueDate && !Number.isNaN(dueDate.getTime())) {
      const diffMs = Date.now() - dueDate.getTime()
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
      overdueDays = Math.max(diffDays, 0)
      isOverdue = diffDays > 0
    }

    return {
      id: tarefa.id,
      title: tarefa.title,
      priority: tarefa.priority || 'NORMAL',
      tags: tarefa.tags || [],
      statusName: statusMap.get(tarefa.statusId)?.name || 'Sem status',
      statusColor: statusMap.get(tarefa.statusId)?.color || 'hsl(var(--muted-foreground))',
      responsibleName: tarefa.assignedTo?.name || 'Não atribuído',
      responsibleColor: tarefa.assignedTo?.color || undefined,
      dueDate: dueDate?.toISOString(),
      isOverdue,
      overdueDays,
    }
  })

  return {
    active: activeTasks.length,
    overdue,
    onTrack,
    completedLast30Days,
    statusDistribution,
    priorityDistribution,
    assigneeDistribution,
    openItems,
  }
}

function calculateWorkflowMetrics<T extends {
  statusId: string
  dueDate?: Date
  updatedAt: Date
  priority: string
}>(
  items: T[],
  statuses: Array<{ id: string; name: string; color: string }>,
): WorkflowDashboardMetrics {
  const statusMap = getStatusMap(statuses)
  const openItems = items.filter((item) => isOpenWorkflowStatusName(statusMap.get(item.statusId)?.name))
  const overdue = openItems.filter((item) => isPastDue(item.dueDate)).length
  const urgent = openItems.filter((item) => ['URGENTE', 'ALTA'].includes((item.priority || '').toUpperCase())).length
  const completedLast30Days = items.filter((item) => {
    const status = statusMap.get(item.statusId)
    return isCompletedStatusName(status?.name) && isWithinLastDays(item.updatedAt, 30)
  }).length

  const statusDistribution = countByName(
    openItems,
    (item) => statusMap.get(item.statusId)?.name || 'Sem status',
    (name, index) => statusMap.get(Array.from(statusMap.values()).find((status) => status.name === name)?.id || '')?.color || DEFAULT_CHART_COLORS[index % DEFAULT_CHART_COLORS.length],
  )

  return {
    open: openItems.length,
    overdue,
    urgent,
    completedLast30Days,
    statusDistribution,
  }
}

function getLatestBalanceteByCondominium(balancetes: Balancete[], condominiumId: string) {
  return balancetes
    .filter((balancete) => balancete.condominium_id === condominiumId)
    .sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime())[0] || null
}

function calculateBalancetesMetrics(
  balancetes: Balancete[],
  condominiums: Condominium[],
): BalancetesDashboardMetrics {
  const activeCondominiums = condominiums.filter((condominium) => condominium.active !== false)
  const rows = activeCondominiums.map((condominium) => {
    const latestBalancete = getLatestBalanceteByCondominium(balancetes, condominium.id)
    const status = getBalanceteStatus(latestBalancete?.competencia || null)
    return {
      condominium,
      balancete: latestBalancete,
      status,
    }
  })

  const onTrack = rows.filter((row) => row.status === 'green').length
  const attention = rows.filter((row) => row.status === 'yellow').length
  const overdue = rows.filter((row) => row.status === 'red').length
  const missing = rows.filter((row) => row.status === 'none').length
  const receivedLast30Days = balancetes.filter((balancete) => isWithinLastDays(balancete.received_at, 30)).length

  return {
    onTrack,
    attention,
    overdue,
    missing,
    receivedLast30Days,
    healthDistribution: [
      { name: getBalanceteStatusLabel('green'), value: onTrack, color: BALANCETE_COLORS.green },
      { name: getBalanceteStatusLabel('yellow'), value: attention, color: BALANCETE_COLORS.yellow },
      { name: getBalanceteStatusLabel('red'), value: overdue, color: BALANCETE_COLORS.red },
      { name: getBalanceteStatusLabel('none'), value: missing, color: BALANCETE_COLORS.none },
    ],
  }
}

function createHighlights(metrics: Omit<DashboardMetrics, 'highlights'>): HighlightItem[] {
  const items: HighlightItem[] = [
    {
      id: 'tarefas-vencidas',
      label: `${metrics.tarefas.overdue} tarefas vencidas`,
      value: metrics.tarefas.overdue,
      tone: 'critical',
    },
    {
      id: 'admissoes-urgentes',
      label: `${metrics.admissoes.urgent} admissões urgentes ou altas`,
      value: metrics.admissoes.urgent,
      tone: 'attention',
    },
    {
      id: 'rescisoes-vencidas',
      label: `${metrics.rescisoes.overdue} rescisões vencidas`,
      value: metrics.rescisoes.overdue,
      tone: 'critical',
    },
    {
      id: 'balancetes-atrasados',
      label: `${metrics.balancetes.overdue} condomínios com balancete atrasado`,
      value: metrics.balancetes.overdue,
      tone: 'critical',
    },
    {
      id: 'atas-atrasadas',
      label: `${metrics.atas.overdue} atas com atraso operacional`,
      value: metrics.atas.overdue,
      tone: 'attention',
    },
  ]

  return items
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 4)
}

export function getTopAssignees(
  tarefas: TarefasDashboardMetrics,
): Array<{ name: string; value: number }> {
  return (tarefas.assigneeDistribution || []).slice(0, 5)
}

export function buildDashboardMetrics(params: {
  atas: Ata[]
  atasStatuses: Status[]
  tarefas: Tarefa[]
  tarefaStatuses: TarefaStatus[]
  admissoes: Admissao[]
  admissaoStatuses: Array<{ id: string; name: string; color: string }>
  rescisoes: Rescisao[]
  rescisaoStatuses: Array<{ id: string; name: string; color: string }>
  balancetes: Balancete[]
  condominiums: Condominium[]
}): DashboardMetrics {
  const atas = calculateAtasMetrics(params.atas, params.atasStatuses)
  const tarefas = calculateTarefasMetrics(params.tarefas, params.tarefaStatuses)
  const admissoes = calculateWorkflowMetrics(params.admissoes, params.admissaoStatuses)
  const rescisoes = calculateWorkflowMetrics(params.rescisoes, params.rescisaoStatuses)
  const balancetes = calculateBalancetesMetrics(params.balancetes, params.condominiums)

  const overview: OverviewMetrics = {
    totalOpenItems: atas.open + tarefas.active + admissoes.open + rescisoes.open + balancetes.overdue + balancetes.attention + balancetes.missing,
    totalCriticalItems: tarefas.overdue + admissoes.urgent + rescisoes.urgent + balancetes.overdue + atas.overdue,
    totalOverdueItems: tarefas.overdue + admissoes.overdue + rescisoes.overdue + balancetes.overdue + atas.overdue,
    completedLast30Days: atas.approvedLast30Days + tarefas.completedLast30Days + admissoes.completedLast30Days + rescisoes.completedLast30Days,
    openByModule: [
      { name: 'Atas', value: atas.open, color: MODULE_COLORS.Atas },
      { name: 'Tarefas', value: tarefas.active, color: MODULE_COLORS.Tarefas },
      { name: 'Admissões', value: admissoes.open, color: MODULE_COLORS.Admissoes },
      { name: 'Rescisões', value: rescisoes.open, color: MODULE_COLORS.Rescisoes },
      { name: 'Balancetes', value: balancetes.overdue + balancetes.attention + balancetes.missing, color: MODULE_COLORS.Balancetes },
    ],
  }

  const metricsWithoutHighlights = {
    overview,
    atas,
    tarefas,
    admissoes,
    rescisoes,
    balancetes,
  }

  return {
    ...metricsWithoutHighlights,
    highlights: createHighlights(metricsWithoutHighlights),
  }
}

export function getOperationalBottlenecks(metrics: DashboardMetrics) {
  return [
    { label: 'Tarefas vencidas', value: metrics.tarefas.overdue },
    { label: 'Admissões urgentes', value: metrics.admissoes.urgent },
    { label: 'Rescisões vencidas', value: metrics.rescisoes.overdue },
    { label: 'Balancetes atrasados', value: metrics.balancetes.overdue },
    { label: 'Atas atrasadas', value: metrics.atas.overdue },
  ]
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
}

export function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toString()
}

export function formatPercentage(num: number): string {
  return `${num}%`
}

export function daysDifference(date1: Date, date2: Date): number {
  const diffTime = Math.abs(date2.getTime() - date1.getTime())
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

export function isOverdue(date: string | Date): boolean {
  return isPastDue(date)
}

export function getUserLabel(user?: UserRef) {
  return user?.name || 'Não atribuído'
}
