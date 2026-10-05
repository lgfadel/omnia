import { supabase } from '@/integrations/supabase/client'
import type { Json } from '@/integrations/supabase/db-types'
import {
  balanceteRowKey,
  findDuplicateBalanceteKeys,
  planBalanceteCsvUpsert,
  type BalanceteCsvUpsertPlan,
} from '@/lib/balanceteCsvImport'
import { logger } from '../lib/logging'
import { condominiumAliasesRepoSupabase, type CondominiumAliasToSave } from './condominiumAliasesRepo.supabase'

const PAGE_SIZE = 1000
const CONDOMINIUM_ID_CHUNK_SIZE = 100

export interface BalanceteCsvCommitRow {
  condominiumId: string
  competencia: string
  dataCriacaoIso: string
}

export interface BalanceteCsvCommitRowOutcome {
  condominiumId: string
  competencia: string
  action: BalanceteCsvUpsertPlan['action']
}

export interface BalanceteCsvCommitResult {
  batchId: string
  createdCount: number
  updatedCount: number
  noopCount: number
  aliasesSavedCount: number
  outcomes: BalanceteCsvCommitRowOutcome[]
}

export interface ExistingBalanceteForImport {
  id: string
  condominium_id: string
  competencia: string
  received_at: string | null
  digital_prepared_at: string | null
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

export const balanceteCsvImportsRepoSupabase = {
  /**
   * Balancetes já gravados para os condomínios/competências do CSV. Escopado (em vez de reaproveitar a
   * lista do dashboard) e paginado: o PostgREST corta respostas em 1000 linhas e uma lista incompleta
   * faria um balancete existente parecer novo.
   */
  async loadExisting(condominiumIds: string[], competencias: string[]): Promise<ExistingBalanceteForImport[]> {
    if (condominiumIds.length === 0 || competencias.length === 0) return []

    const existing: ExistingBalanceteForImport[] = []

    for (const idsChunk of chunk(condominiumIds, CONDOMINIUM_ID_CHUNK_SIZE)) {
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await supabase
          .from('omnia_balancetes')
          .select('id, condominium_id, competencia, received_at, digital_prepared_at')
          .in('condominium_id', idsChunk)
          .in('competencia', competencias)
          .order('id')
          .range(from, from + PAGE_SIZE - 1)

        if (error) throw error

        existing.push(...(data ?? []))
        if ((data?.length ?? 0) < PAGE_SIZE) break
      }
    }

    return existing
  },

  async commit(params: {
    originalFilename: string
    rows: BalanceteCsvCommitRow[]
    createdBy: string
    /** Linhas do arquivo que o usuário desmarcou; entram só no registro do lote. */
    ignoredCount?: number
    /** Linhas do arquivo que já estavam em dia e por isso nem foram para revisão. */
    unchangedCount?: number
    aliasesToSave?: CondominiumAliasToSave[]
  }): Promise<BalanceteCsvCommitResult> {
    const { originalFilename, rows, createdBy, ignoredCount = 0, unchangedCount = 0, aliasesToSave = [] } = params

    if (rows.length === 0) {
      throw new Error('Nenhuma linha para importar')
    }

    if (findDuplicateBalanceteKeys(rows).length > 0) {
      throw new Error(
        'Duas linhas apontam para o mesmo condomínio e competência. Ignore uma delas ou corrija o condomínio selecionado.'
      )
    }

    const condominiumIds = Array.from(new Set(rows.map((row) => row.condominiumId)))
    const competencias = Array.from(new Set(rows.map((row) => row.competencia)))

    const isDigitalById = new Map<string, boolean>()
    for (const idsChunk of chunk(condominiumIds, CONDOMINIUM_ID_CHUNK_SIZE)) {
      const { data: condominiums, error: condominiumsError } = await supabase
        .from('omnia_condominiums')
        .select('id, balancete_digital')
        .in('id', idsChunk)

      if (condominiumsError) {
        throw condominiumsError
      }

      for (const condominium of condominiums ?? []) {
        isDigitalById.set(condominium.id, condominium.balancete_digital === true)
      }
    }

    const existingBalancetes = await this.loadExisting(condominiumIds, competencias)
    const existingByKey = new Map(
      existingBalancetes.map((balancete) => [
        balanceteRowKey(balancete.condominium_id, balancete.competencia),
        balancete,
      ])
    )

    const { data: batchRow, error: batchInsertError } = await supabase
      .from('omnia_balancete_csv_import_batches')
      .insert({
        original_filename: originalFilename,
        total_rows: rows.length + ignoredCount + unchangedCount,
        ignored_count: ignoredCount,
        created_by: createdBy,
      })
      .select('id')
      .single()

    if (batchInsertError || !batchRow?.id) {
      throw new Error(`Falha ao registrar lote de importação: ${batchInsertError?.message ?? 'erro desconhecido'}`)
    }

    let createdCount = 0
    let updatedCount = 0
    let noopCount = 0
    const outcomes: BalanceteCsvCommitRowOutcome[] = []

    for (const row of rows) {
      const existing = existingByKey.get(balanceteRowKey(row.condominiumId, row.competencia))
      const isDigitalCondominium = isDigitalById.get(row.condominiumId) ?? false

      const plan = planBalanceteCsvUpsert({
        isDigitalCondominium,
        dataCriacaoIso: row.dataCriacaoIso,
        existing: existing
          ? { receivedAt: existing.received_at, digitalPreparedAt: existing.digital_prepared_at }
          : null,
      })

      if (plan.action === 'create') {
        const { error } = await supabase.from('omnia_balancetes').insert({
          condominium_id: row.condominiumId,
          competencia: row.competencia,
          received_at: plan.patch.received_at,
          digital_prepared_at: plan.patch.digital_prepared_at,
          volumes: 1,
          created_by: createdBy,
          csv_import_batch_id: batchRow.id,
        })

        if (error) throw error
        createdCount += 1
      } else if (plan.action === 'update' && existing) {
        const { error } = await supabase
          .from('omnia_balancetes')
          .update({ ...plan.patch, csv_import_batch_id: batchRow.id })
          .eq('id', existing.id)

        if (error) throw error
        updatedCount += 1
      } else {
        noopCount += 1
      }

      outcomes.push({ condominiumId: row.condominiumId, competencia: row.competencia, action: plan.action })
    }

    const { error: batchUpdateError } = await supabase
      .from('omnia_balancete_csv_import_batches')
      .update({
        created_count: createdCount,
        updated_count: updatedCount,
        details: outcomes as unknown as Json,
      })
      .eq('id', batchRow.id)

    if (batchUpdateError) {
      logger.error('Failed to update csv import batch counters', batchUpdateError)
    }

    // Os balancetes já estão gravados: falhar ao memorizar nomes não deve desfazer nem esconder a importação.
    let aliasesSavedCount = 0
    try {
      aliasesSavedCount = await condominiumAliasesRepoSupabase.upsertMany(aliasesToSave, createdBy)
    } catch (aliasError) {
      logger.warn('Failed to save condominium aliases after csv import', aliasError)
    }

    return { batchId: batchRow.id, createdCount, updatedCount, noopCount, aliasesSavedCount, outcomes }
  },
}
