import { describe, expect, it } from 'vitest'
import { buildDashboardMetrics } from '../dashboardCalculations'

describe('dashboardCalculations', () => {
  it('consolida backlog, vencimentos, recorte de 30 dias e highlights', () => {
    const now = new Date()
    const fiveDaysAgo = new Date(now)
    fiveDaysAgo.setDate(now.getDate() - 5)
    const fortyDaysAgo = new Date(now)
    fortyDaysAgo.setDate(now.getDate() - 40)
    const twentyDaysAgo = new Date(now)
    twentyDaysAgo.setDate(now.getDate() - 20)

    const metrics = buildDashboardMetrics({
      atas: [
        {
          id: 'ata-1',
          title: 'Ata aberta',
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          meetingDate: fortyDaysAgo.toISOString(),
          statusId: 'ata-open',
        },
        {
          id: 'ata-2',
          title: 'Ata aprovada',
          createdAt: fortyDaysAgo.toISOString(),
          updatedAt: fiveDaysAgo.toISOString(),
          meetingDate: fortyDaysAgo.toISOString(),
          statusId: 'ata-approved',
        },
      ],
      atasStatuses: [
        { id: 'ata-open', name: 'Em Andamento', color: '#111111', order: 1 },
        { id: 'ata-approved', name: 'Aprovada', color: '#222222', order: 2 },
        { id: 'task-open', name: 'Pendente', color: '#333333', order: 3 },
        { id: 'task-done', name: 'Concluído', color: '#444444', order: 4 },
      ],
      tarefas: [
        {
          id: 'task-1',
          title: 'Tarefa vencida',
          priority: 'URGENTE',
          statusId: 'task-open',
          dueDate: fiveDaysAgo,
          assignedTo: { id: 'u1', name: 'Ana', email: 'ana@example.com', roles: ['USUARIO'] },
          tags: [],
          commentCount: 0,
          attachmentCount: 0,
          createdAt: now,
          updatedAt: now,
          isPrivate: false,
        },
        {
          id: 'task-2',
          title: 'Tarefa concluída',
          priority: 'NORMAL',
          statusId: 'task-done',
          tags: [],
          commentCount: 0,
          attachmentCount: 0,
          createdAt: fortyDaysAgo,
          updatedAt: fiveDaysAgo,
          isPrivate: false,
        },
      ],
      tarefaStatuses: [
        { id: 'task-open', name: 'Pendente', color: '#333333', order: 1 },
        { id: 'task-done', name: 'Concluído', color: '#444444', order: 2 },
      ],
      admissoes: [
        {
          id: 'adm-1',
          title: 'Admissão urgente',
          priority: 'ALTA',
          statusId: 'adm-open',
          dueDate: fiveDaysAgo,
          tags: [],
          commentCount: 0,
          attachmentCount: 0,
          createdAt: now,
          updatedAt: now,
          isPrivate: false,
        },
        {
          id: 'adm-2',
          title: 'Admissão concluída',
          priority: 'NORMAL',
          statusId: 'adm-done',
          tags: [],
          commentCount: 0,
          attachmentCount: 0,
          createdAt: fortyDaysAgo,
          updatedAt: fiveDaysAgo,
          isPrivate: false,
        },
      ],
      admissaoStatuses: [
        { id: 'adm-open', name: 'Em progresso', color: '#00aa88' },
        { id: 'adm-done', name: 'Finalizado', color: '#00bb88' },
      ],
      rescisoes: [
        {
          id: 'res-1',
          title: 'Rescisão vencida',
          priority: 'NORMAL',
          statusId: 'res-open',
          dueDate: fiveDaysAgo,
          tags: [],
          commentCount: 0,
          attachmentCount: 0,
          createdAt: now,
          updatedAt: now,
          isPrivate: false,
        },
      ],
      rescisaoStatuses: [
        { id: 'res-open', name: 'Em andamento', color: '#cc2200' },
      ],
      balancetes: [
        {
          id: 'bal-1',
          condominium_id: 'c1',
          received_at: twentyDaysAgo.toISOString(),
          competencia: `${String(now.getMonth()).padStart(2, '0')}/${now.getFullYear()}`,
          volumes: 1,
          status: 'received',
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        },
      ],
      condominiums: [
        { id: 'c1', name: 'Condomínio em dia', active: true, created_at: null, updated_at: null },
        { id: 'c2', name: 'Condomínio sem balancete', active: true, created_at: null, updated_at: null },
      ],
    })

    expect(metrics.atas.open).toBe(1)
    expect(metrics.atas.overdue).toBe(1)
    expect(metrics.atas.approvedLast30Days).toBe(1)
    expect(metrics.atas.openItems[0]?.statusName).toBe('Em Andamento')
    expect(metrics.atas.openItems[0]?.isOperationallyOverdue).toBe(true)

    expect(metrics.tarefas.active).toBe(1)
    expect(metrics.tarefas.overdue).toBe(1)
    expect(metrics.tarefas.completedLast30Days).toBe(1)
    expect(metrics.tarefas.statusDistribution[0]?.name).toBe('Pendente')

    expect(metrics.admissoes.open).toBe(1)
    expect(metrics.admissoes.overdue).toBe(1)
    expect(metrics.admissoes.urgent).toBe(1)
    expect(metrics.admissoes.completedLast30Days).toBe(1)

    expect(metrics.rescisoes.open).toBe(1)
    expect(metrics.rescisoes.overdue).toBe(1)

    expect(metrics.balancetes.onTrack).toBe(1)
    expect(metrics.balancetes.missing).toBe(1)
    expect(metrics.balancetes.receivedLast30Days).toBe(1)

    expect(metrics.overview.completedLast30Days).toBe(3)
    expect(metrics.highlights.some((item) => item.label.includes('tarefas vencidas'))).toBe(true)
  })
})
