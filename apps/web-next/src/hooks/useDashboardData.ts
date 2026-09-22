import { useCallback, useEffect, useMemo, useState } from 'react'
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

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; lastUpdated: Date }
  | { status: 'failed' }

export function useDashboardData() {
  // Tudo o mais é derivado das stores a cada render. Guardar métricas, loading e
  // erro num estado copiado por efeitos custava um render extra a cada mudança e
  // deixava as três cópias divergirem entre si.
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })

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

  // Resolve quando todas as stores terminam; quem chama decide o que marcar no
  // estado, depois do await.
  const fetchAll = useCallback(
    () =>
      Promise.all([
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
      ]),
    [
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
    ],
  )

  useEffect(() => {
    let cancelled = false
    fetchAll()
      .then(() => {
        if (!cancelled) setLoad({ status: 'ready', lastUpdated: new Date() })
      })
      .catch((error) => {
        logger.error('Erro ao carregar dados do dashboard:', error)
        if (!cancelled) setLoad({ status: 'failed' })
      })
    return () => {
      cancelled = true
    }
  }, [fetchAll])

  const refresh = useCallback(async () => {
    setLoad({ status: 'loading' })
    try {
      await fetchAll()
      setLoad({ status: 'ready', lastUpdated: new Date() })
    } catch (error) {
      logger.error('Erro ao carregar dados do dashboard:', error)
      setLoad({ status: 'failed' })
    }
  }, [fetchAll])

  // Calculadas sempre a partir do que as stores têm. Enquanto algo carrega, a
  // tela mostra o skeleton, então métricas parciais nunca chegam a aparecer.
  const computed = useMemo((): { metrics: DashboardMetrics; error: string | null } => {
    try {
      return {
        metrics: buildDashboardMetrics({
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
        }),
        error: null,
      }
    } catch (error) {
      logger.error('Erro ao calcular métricas do dashboard:', error)
      return { metrics: EMPTY_DASHBOARD_METRICS, error: 'Erro ao calcular métricas do dashboard' }
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

  const storesLoading =
    atasLoading ||
    tarefasLoading ||
    tarefaStatusesLoading ||
    admissoesLoading ||
    admissaoStatusesLoading ||
    rescisoesLoading ||
    rescisaoStatusesLoading ||
    balancetesLoading ||
    condominiumsLoading

  const storeError =
    atasError ||
    tarefasError ||
    tarefaStatusesError ||
    admissoesError ||
    admissaoStatusesError ||
    rescisoesError ||
    rescisaoStatusesError ||
    balancetesError ||
    condominiumsError

  const error =
    (load.status === 'failed' ? 'Erro ao carregar dados do dashboard' : null) ?? storeError ?? computed.error
  // Com erro, a tela sai do skeleton para mostrar a mensagem.
  const loading = !error && (load.status === 'loading' || storesLoading)
  const dashboardData: DashboardData = {
    ...computed.metrics,
    loading,
    error: error || null,
    lastUpdated: load.status === 'ready' ? load.lastUpdated : null,
  }

  return {
    ...dashboardData,
    refresh,
    isLoading: loading || storesLoading,
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
