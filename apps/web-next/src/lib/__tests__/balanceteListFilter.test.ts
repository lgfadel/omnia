import { describe, expect, it } from 'vitest'
import type { Balancete } from '@/repositories/balancetesRepo.supabase'
import {
  filterBalancetesForList,
  getBalanceteEnvioStatus,
  type BalanceteListFilters,
  type StatusEnvioOption,
} from '../balanceteListFilter'

function balancete(overrides: Partial<Balancete> = {}): Balancete {
  return {
    id: 'b1',
    condominium_id: 'c1',
    condominium_name: 'CONDOMINIO VILLAGE LA CORUNA',
    balancete_digital: false,
    received_at: '2026-09-21',
    competencia: '08/2026',
    volumes: 1,
    observations: null,
    status: 'recebido',
    sent_at: null,
    protocolo_id: null,
    created_at: null,
    updated_at: null,
    ...overrides,
  }
}

function filters(overrides: Partial<BalanceteListFilters> = {}): BalanceteListFilters {
  return {
    searchQuery: '',
    statusEnvio: new Set<StatusEnvioOption>(['pendentes', 'enviados']),
    anexo: 'todos',
    attachmentCounts: {},
    protocolosMap: new Map(),
    ...overrides,
  }
}

describe('getBalanceteEnvioStatus', () => {
  it('enviado quando tem sent_at ou data de envio do protocolo', () => {
    expect(getBalanceteEnvioStatus(balancete({ sent_at: '2026-10-01' }), null)).toBe('enviados')
    expect(getBalanceteEnvioStatus(balancete(), '2026-10-01')).toBe('enviados')
  })

  it('digital quando o condominio e digital e nao foi enviado; senao pendente', () => {
    expect(getBalanceteEnvioStatus(balancete({ balancete_digital: true }), null)).toBe('digital')
    expect(getBalanceteEnvioStatus(balancete({ balancete_digital: false }), null)).toBe('pendentes')
  })
})

describe('filterBalancetesForList', () => {
  const digital = balancete({ id: 'digital', balancete_digital: true })
  const pendente = balancete({ id: 'pendente', condominium_name: 'ALPHA MALL' })
  const enviado = balancete({ id: 'enviado', condominium_name: 'CAROLINE', sent_at: '2026-10-01' })
  const all = [digital, pendente, enviado]

  it('sem busca, aplica o filtro de status (digital fica de fora no padrao)', () => {
    const result = filterBalancetesForList(all, filters())

    expect(result.map((b) => b.id)).toEqual(['pendente', 'enviado'])
  })

  it('sem busca e sem nenhum status marcado, a lista fica vazia', () => {
    expect(filterBalancetesForList(all, filters({ statusEnvio: new Set() }))).toEqual([])
  })

  it('com busca, ignora o filtro de status e acha o balancete digital', () => {
    const result = filterBalancetesForList(all, filters({ searchQuery: 'village' }))

    expect(result.map((b) => b.id)).toEqual(['digital'])
  })

  it('com busca, ignora o filtro de status mesmo com nenhum status marcado', () => {
    const result = filterBalancetesForList(all, filters({ searchQuery: 'alpha', statusEnvio: new Set() }))

    expect(result.map((b) => b.id)).toEqual(['pendente'])
  })

  it('com busca, ignora tambem o filtro de anexos', () => {
    const result = filterBalancetesForList(
      all,
      filters({ searchQuery: 'village', anexo: 'com-anexo', attachmentCounts: {} })
    )

    expect(result.map((b) => b.id)).toEqual(['digital'])
  })

  it('busca por nome, competencia e observacoes, sem diferenciar maiusculas', () => {
    const comObs = balancete({ id: 'obs', condominium_name: 'OUTRO', competencia: '07/2026', observations: 'Volume Extra' })

    expect(filterBalancetesForList([comObs], filters({ searchQuery: 'volume extra' }))).toHaveLength(1)
    expect(filterBalancetesForList([comObs], filters({ searchQuery: '07/2026' }))).toHaveLength(1)
    expect(filterBalancetesForList([comObs], filters({ searchQuery: 'outro' }))).toHaveLength(1)
    expect(filterBalancetesForList([comObs], filters({ searchQuery: 'inexistente' }))).toHaveLength(0)
  })

  it('busca so com espacos conta como sem busca e volta a aplicar os filtros', () => {
    const result = filterBalancetesForList(all, filters({ searchQuery: '   ' }))

    expect(result.map((b) => b.id)).toEqual(['pendente', 'enviado'])
  })

  it('sem busca, aplica o filtro de anexos', () => {
    const result = filterBalancetesForList(
      all,
      filters({ anexo: 'com-anexo', attachmentCounts: { enviado: 2 } })
    )

    expect(result.map((b) => b.id)).toEqual(['enviado'])
  })

  it('usa a data de envio do protocolo para classificar como enviado', () => {
    const comProtocolo = balancete({ id: 'p', protocolo_id: 'prot-1' })
    const result = filterBalancetesForList(
      [comProtocolo],
      filters({
        statusEnvio: new Set<StatusEnvioOption>(['enviados']),
        protocolosMap: new Map([['prot-1', { data_envio: '2026-10-02' }]]),
      })
    )

    expect(result).toHaveLength(1)
  })
})
