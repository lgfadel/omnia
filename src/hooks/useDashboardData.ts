import { useEffect, useState, useCallback } from 'react'
import { useAtasStore } from '@/store/atas.store'
import { useTarefasStore } from '@/store/tarefas.store'
import { calculateAtasMetrics, calculateTarefasMetrics, type AtasMetrics, type TarefasMetrics } from '@/utils/dashboardCalculations'

export interface DashboardData {
  atasMetrics: AtasMetrics
  tarefasMetrics: TarefasMetrics
  loading: boolean
  error: string | null
  lastUpdated: Date | null
}

export function useDashboardData() {
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    atasMetrics: {
      total: 0,
      distribuicaoPorStatus: [],
      atasAtrasadas: 0,
      taxaConclusao: 0
    },
    tarefasMetrics: {
      totalAtivas: 0,
      distribuicaoPorStatus: [],
      distribuicaoPorPrioridade: [],
      distribuicaoPorResponsavel: [],
      tarefasVencidas: 0,
      tarefasNoPrazo: 0,
      taxaConclusao: 0
    },
    loading: true,
    error: null,
    lastUpdated: null
  })

  const {
    atas,
    statuses: atasStatuses,
    loading: atasLoading,
    error: atasError,
    loadAtas,
    loadStatuses
  } = useAtasStore()

  const {
    tarefas,
    loading: tarefasLoading,
    error: tarefasError,
    loadTarefas
  } = useTarefasStore()

  // Função para carregar todos os dados necessários
  const loadDashboardData = useCallback(async () => {
    try {
      setDashboardData(prev => ({ ...prev, loading: true, error: null }))
      
      // Carregar dados em paralelo
      await Promise.all([
        loadAtas(),
        loadStatuses(),
        loadTarefas()
      ])
    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error)
      setDashboardData(prev => ({
        ...prev,
        loading: false,
        error: 'Erro ao carregar dados do dashboard'
      }))
    }
  }, [loadAtas, loadStatuses, loadTarefas, setDashboardData])

  // Função para calcular métricas quando os dados estão disponíveis
  const calculateMetrics = useCallback(() => {
    if (atas.length === 0 && tarefas.length === 0) {
      return // Ainda carregando dados
    }

    try {
      const atasMetrics = calculateAtasMetrics(atas, atasStatuses)
      const tarefasMetrics = calculateTarefasMetrics(tarefas, atasStatuses)
      
      setDashboardData(prev => ({
        ...prev,
        atasMetrics,
        tarefasMetrics,
        loading: false,
        error: null,
        lastUpdated: new Date()
      }))
    } catch (error) {
      console.error('Erro ao calcular métricas:', error)
      setDashboardData(prev => ({
        ...prev,
        loading: false,
        error: 'Erro ao calcular métricas do dashboard'
      }))
    }
  }, [atas, tarefas, atasStatuses, setDashboardData])

  // Carregar dados iniciais
  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  // Recalcular métricas quando os dados mudarem
  useEffect(() => {
    if (!atasLoading && !tarefasLoading) {
      calculateMetrics()
    }
  }, [atas, tarefas, atasStatuses, atasLoading, tarefasLoading, calculateMetrics])

  // Verificar erros dos stores
  useEffect(() => {
    const error = atasError || tarefasError
    if (error) {
      setDashboardData(prev => ({
        ...prev,
        loading: false,
        error
      }))
    }
  }, [atasError, tarefasError])

  return {
    ...dashboardData,
    refresh: loadDashboardData,
    isLoading: dashboardData.loading || atasLoading || tarefasLoading
  }
}

// Hook para métricas específicas de atas
export function useAtasMetrics() {
  const { atasMetrics, loading, error } = useDashboardData()
  return { atasMetrics, loading, error }
}

// Hook para métricas específicas de tarefas
export function useTarefasMetrics() {
  const { tarefasMetrics, loading, error } = useDashboardData()
  return { tarefasMetrics, loading, error }
}

// Hook para dados resumidos do dashboard
export function useDashboardSummary() {
  const { atasMetrics, tarefasMetrics, loading, error, lastUpdated } = useDashboardData()
  
  return {
    summary: {
      totalAtas: atasMetrics.total,
      atasAtrasadas: atasMetrics.atasAtrasadas,
      taxaConclusaoAtas: atasMetrics.taxaConclusao,
      totalTarefasAtivas: tarefasMetrics.totalAtivas,
      tarefasVencidas: tarefasMetrics.tarefasVencidas,
      taxaConclusaoTarefas: tarefasMetrics.taxaConclusao
    },
    loading,
    error,
    lastUpdated
  }
}