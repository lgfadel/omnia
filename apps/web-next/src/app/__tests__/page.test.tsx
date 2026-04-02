import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Page from '../page'

vi.mock('@/components/auth/ProtectedRoute', () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/layout/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))

vi.mock('@/components/ui/breadcrumb-omnia', () => ({
  BreadcrumbOmnia: () => <div>Breadcrumb</div>,
}))

vi.mock('@/components/dashboard/DashboardHero', () => ({
  DashboardHero: () => <div>Hero</div>,
}))

vi.mock('@/components/dashboard/DashboardSectionHeader', () => ({
  DashboardSectionHeader: ({ title }: any) => <div>{title}</div>,
}))

vi.mock('@/components/dashboard/AtasStatusBoard', () => ({
  AtasStatusBoard: ({ totalOpen }: any) => <div>ATAS: {totalOpen}</div>,
}))

vi.mock('@/components/dashboard/TarefasStatusBoard', () => ({
  TarefasStatusBoard: ({ totalOpen }: any) => <div>TAREFAS: {totalOpen}</div>,
}))

vi.mock('@/components/dashboard/TarefasPriorityCard', () => ({
  TarefasPriorityCard: ({ items }: any) => <div>PRIORIDADES: {items.length}</div>,
}))

vi.mock('@/components/dashboard/TarefasTagsCloud', () => ({
  TarefasTagsCloud: ({ items }: any) => <div>TAGS: {items.length}</div>,
}))

vi.mock('@/components/dashboard/ExecutiveKpi', () => ({
  ExecutiveKpi: ({ title, value }: any) => <div>{title}: {value}</div>,
}))

vi.mock('@/components/dashboard/RechartsBarChart', () => ({
  default: ({ title }: any) => <div>{title}</div>,
}))

vi.mock('@/components/dashboard/RechartsDonutChart', () => ({
  RechartsDonutChart: ({ title }: any) => <div>{title}</div>,
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
}))

const mockUseDashboardData = vi.fn()

vi.mock('@/hooks/useDashboardData', () => ({
  useDashboardData: () => mockUseDashboardData(),
}))

describe('dashboard page', () => {
  it('renderiza loading skeleton', () => {
    mockUseDashboardData.mockReturnValue({
      loading: true,
      error: null,
      overview: {},
      atas: {},
      tarefas: {},
      admissoes: {},
      rescisoes: {},
      balancetes: {},
      highlights: [],
      lastUpdated: null,
    })

    render(<Page />)

    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('renderiza a visão executiva com dados', () => {
    mockUseDashboardData.mockReturnValue({
      loading: false,
      error: null,
      lastUpdated: new Date(),
      highlights: [{ id: 'h1', label: '3 tarefas vencidas', tone: 'critical' }],
      overview: {
        totalOpenItems: 22,
        totalCriticalItems: 6,
        totalOverdueItems: 4,
        completedLast30Days: 11,
        openByModule: [],
      },
      atas: { open: 4, overdue: 1, approvedLast30Days: 2, statusDistribution: [], openItems: [] },
      tarefas: {
        active: 8,
        overdue: 3,
        onTrack: 5,
        completedLast30Days: 4,
        statusDistribution: [],
        priorityDistribution: [],
        assigneeDistribution: [{ name: 'Ana', value: 4 }],
        openItems: [{ id: 't1', title: 'Tarefa 1', priority: 'ALTA', tags: ['juridico'] }],
      },
      admissoes: { open: 3, overdue: 1, urgent: 2, completedLast30Days: 1, statusDistribution: [] },
      rescisoes: { open: 2, overdue: 1, urgent: 1, completedLast30Days: 1, statusDistribution: [] },
      balancetes: {
        onTrack: 12,
        attention: 2,
        overdue: 1,
        missing: 1,
        receivedLast30Days: 9,
        healthDistribution: [],
      },
    })

    render(<Page />)

    expect(screen.getByText('Hero')).toBeInTheDocument()
    expect(screen.getByText('Abertos por status')).toBeInTheDocument()
    expect(screen.getByText('ATAS: 4')).toBeInTheDocument()
    expect(screen.getByText('TAREFAS: 8')).toBeInTheDocument()
    expect(screen.getByText('PRIORIDADES: 1')).toBeInTheDocument()
    expect(screen.getByText('TAGS: 1')).toBeInTheDocument()
    expect(screen.getByText('Responsáveis com maior carga')).toBeInTheDocument()
    expect(screen.getByText('Onde está o gargalo')).toBeInTheDocument()
  })

  it('renderiza erro consolidado', () => {
    mockUseDashboardData.mockReturnValue({
      loading: false,
      error: 'Falha ao buscar dados',
      overview: {},
      atas: {},
      tarefas: {},
      admissoes: {},
      rescisoes: {},
      balancetes: {},
      highlights: [],
      lastUpdated: null,
    })

    render(<Page />)

    expect(screen.getByText('Dashboard indisponível')).toBeInTheDocument()
    expect(screen.getByText('Falha ao buscar dados')).toBeInTheDocument()
  })
})
