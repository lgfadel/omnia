import type { Balancete } from '@/repositories/balancetesRepo.supabase'

export type StatusEnvioOption = 'enviados' | 'pendentes' | 'digital'
export type AnexoFilter = 'todos' | 'com-anexo' | 'sem-anexo'

export function getBalanceteEnvioStatus(
  balancete: Balancete,
  protocoloDataEnvio: string | null | undefined
): StatusEnvioOption {
  const isSent = Boolean(balancete.sent_at || protocoloDataEnvio)

  if (isSent) {
    return 'enviados'
  }

  if (balancete.balancete_digital === true) {
    return 'digital'
  }

  return 'pendentes'
}

export interface BalanceteListFilters {
  searchQuery: string
  statusEnvio: ReadonlySet<StatusEnvioOption>
  anexo: AnexoFilter
  attachmentCounts: Record<string, number>
  protocolosMap: ReadonlyMap<string, { data_envio?: string | null }>
}

/**
 * Com texto na busca, os filtros (status de envio e anexos) deixam de valer: quem procura um condomínio
 * pelo nome precisa achá-lo mesmo que ele esteja num grupo escondido por padrão (ex.: digitais).
 * Sem busca, os filtros valem normalmente.
 */
export function filterBalancetesForList(balancetes: Balancete[], filters: BalanceteListFilters): Balancete[] {
  const query = filters.searchQuery.trim().toLowerCase()

  if (query) {
    return balancetes.filter(
      (b) =>
        (b.condominium_name || '').toLowerCase().includes(query) ||
        b.competencia.includes(query) ||
        (b.observations || '').toLowerCase().includes(query)
    )
  }

  if (filters.statusEnvio.size === 0) return []

  let data = balancetes.filter((b) => {
    const protocolo = b.protocolo_id ? filters.protocolosMap.get(b.protocolo_id) : null
    return filters.statusEnvio.has(getBalanceteEnvioStatus(b, protocolo?.data_envio))
  })

  if (filters.anexo === 'com-anexo') {
    data = data.filter((b) => filters.attachmentCounts[b.id] > 0)
  } else if (filters.anexo === 'sem-anexo') {
    data = data.filter((b) => !filters.attachmentCounts[b.id])
  }

  return data
}
