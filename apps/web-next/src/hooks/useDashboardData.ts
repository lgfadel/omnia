import { useCallback, useEffect, useState } from 'react'
import { useAdmissaoStatusStore } from '@/stores/admissaoStatus.store'
import { useAdmissoesStore } from '@/stores/admissoes.store'
import { useAtasStore } from '@/stores/atas.store'
import { useBalancetesStore } from '@/stores/balancetes.store'
import { useCondominiumStore } from '@/stores/condominiums.store'
import { useRescisaoStatusStore } from '@/stores/rescisaoStatus.store'
import { useRescisoesStore } from '@/stores/rescisoes.store'
import { useTarefaStatusStore } from '@/stores/tarefaStatus.store'
import { useTarefasStore } from '@/stores/tarefas.store'
import { buildDashboardMetrics, type DashboardMetrics } from '@/utils/dashboardCalculations'
import { logger } from '@/lib/logging'

const EMPTY_DASHBOARD_METRICS: DashboardMetrics = {
  overview: {
    totalOpenItems: 0,
    totalCriticalItems: 0,
    totalOverdueItems: 0,
    completedLast30Days: 0,
    openByModule: [],
  },
  atas: {
    open: 0,
    overdue: 0,
    approvedLast30Days: 0,
    statusDistribution: [],
    openItems: [],
  },
  tarefas: {
    active: 0,
    overdue: 0,
    onTrack: 0,
    completedLast30Days: 0,
    statusDistribution: [],
    priorityDistribution: [],
    assigneeDistribution: [],
    openItems: [],
  },
  admissoes: {
    open: 0,
    overdue: 0,
    urgent: 0,
    completedLast30Days: 0,
    statusDistribution: [],
  },
  rescisoes: {
    open: 0,
    overdue: 0,
    urgent: 0,
    completedLast30Days: 0,
    statusDistribution: [],
  },
  balancetes: {
    onTrack: 0,
    attention: 0,
    overdue: 0,
    missing: 0,
    receivedLast30Days: 0,
    healthDistribution: [],
  },
  highlights: [],
}

export interface DashboardData extends DashboardMetrics {
  loading: boolean
  error: string | null
  lastUpdated: Date | null
}

export function useDashboardData() {
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    ...EMPTY_DASHBOARD_METRICS,
    loading: true,
    error: null,
    lastUpdated: null,
  })

  const {
    atas,
    statuses: atasStatuses,
    loading: atasLoading,
    error: atasError,
    loadAtas,
    loadStatuses: loadAtaStatuses,
  } = useAtasStore()

  const {
    tarefas,
    loading: tarefasLoading,
    error: tarefasError,
    loadTarefas,
  } = useTarefasStore()

  const {
    statuses: tarefaStatuses,
    loading: tarefaStatusesLoading,
    error: tarefaStatusesError,
    loadStatuses: loadTarefaStatuses,
  } = useTarefaStatusStore()

  const {
    admissoes,
    loading: admissoesLoading,
    error: admissoesError,
    loadAdmissoes,
  } = useAdmissoesStore()

  const {
    statuses: admissaoStatuses,
    loading: admissaoStatusesLoading,
    error: admissaoStatusesError,
    loadStatuses: loadAdmissaoStatuses,
  } = useAdmissaoStatusStore()

  const {
    rescisoes,
    loading: rescisoesLoading,
    error: rescisoesError,
    loadRescisoes,
  } = useRescisoesStore()

  const {
    statuses: rescisaoStatuses,
    loading: rescisaoStatusesLoading,
    error: rescisaoStatusesError,
    loadStatuses: loadRescisaoStatuses,
  } = useRescisaoStatusStore()

  const {
    balancetes,
    loading: balancetesLoading,
    error: balancetesError,
    loadBalancetes,
  } = useBalancetesStore()

  const {
    condominiums,
    loading: condominiumsLoading,
    error: condominiumsError,
    loadCondominiums,
  } = useCondominiumStore()

  const loadDashboardData = useCallback(async () => {
    try {
      setDashboardData((prev) => ({ ...prev, loading: true, error: null }))

      await Promise.all([
        loadAtas(),
        loadAtaStatuses(),
        loadTarefas(),
        loadTarefaStatuses(),
        loadAdmissoes(),
        loadAdmissaoStatuses(),
        loadRescisoes(),
        loadRescisaoStatuses(),
        loadBalancetes(),
        loadCondominiums(),
      ])
    } catch (error) {
      logger.error('Erro ao carregar dados do dashboard:', error)
      setDashboardData((prev) => ({
        ...prev,
        loading: false,
        error: 'Erro ao carregar dados do dashboard',
      }))
    }
  }, [
    loadAdmissoes,
    loadAdmissaoStatuses,
    loadAtas,
    loadAtaStatuses,
    loadBalancetes,
    loadCondominiums,
    loadRescisoes,
    loadRescisaoStatuses,
    loadTarefaStatuses,
    loadTarefas,
  ])

  const calculateMetrics = useCallback(() => {
    try {
      const metrics = buildDashboardMetrics({
        atas,
        atasStatuses,
        tarefas,
        tarefaStatuses,
        admissoes,
        admissaoStatuses,
        rescisoes,
        rescisaoStatuses,
        balancetes,
        condominiums,
      })

      setDashboardData({
        ...metrics,
        loading: false,
        error: null,
        lastUpdated: new Date(),
      })
    } catch (error) {
      logger.error('Erro ao calcular métricas do dashboard:', error)
      setDashboardData((prev) => ({
        ...prev,
        loading: false,
        error: 'Erro ao calcular métricas do dashboard',
      }))
    }
  }, [
    admissaoStatuses,
    admissoes,
    atas,
    atasStatuses,
    balancetes,
    condominiums,
    rescisoes,
    rescisaoStatuses,
    tarefaStatuses,
    tarefas,
  ])

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  useEffect(() => {
    if (
      !atasLoading &&
      !tarefasLoading &&
      !tarefaStatusesLoading &&
      !admissoesLoading &&
      !admissaoStatusesLoading &&
      !rescisoesLoading &&
      !rescisaoStatusesLoading &&
      !balancetesLoading &&
      !condominiumsLoading
    ) {
      calculateMetrics()
    }
  }, [
    admissaoStatusesLoading,
    admissoesLoading,
    atasLoading,
    balancetesLoading,
    calculateMetrics,
    condominiumsLoading,
    rescisoesLoading,
    rescisaoStatusesLoading,
    tarefaStatusesLoading,
    tarefasLoading,
  ])

  useEffect(() => {
    const error =
      atasError ||
      tarefasError ||
      tarefaStatusesError ||
      admissoesError ||
      admissaoStatusesError ||
      rescisoesError ||
      rescisaoStatusesError ||
      balancetesError ||
      condominiumsError

    if (error) {
      setDashboardData((prev) => ({
        ...prev,
        loading: false,
        error,
      }))
    }
  }, [
    admissaoStatusesError,
    admissoesError,
    atasError,
    balancetesError,
    condominiumsError,
    rescisoesError,
    rescisaoStatusesError,
    tarefaStatusesError,
    tarefasError,
  ])

  return {
    ...dashboardData,
    refresh: loadDashboardData,
    isLoading:
      dashboardData.loading ||
      atasLoading ||
      tarefasLoading ||
      tarefaStatusesLoading ||
      admissoesLoading ||
      admissaoStatusesLoading ||
      rescisoesLoading ||
      rescisaoStatusesLoading ||
      balancetesLoading ||
      condominiumsLoading,
  }
}

export function useDashboardSummary() {
  const { overview, highlights, loading, error, lastUpdated } = useDashboardData()

  return {
    overview,
    highlights,
    loading,
    error,
    lastUpdated,
  }
}
