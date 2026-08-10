import { supabase } from '@/integrations/supabase/client'
import type { Json } from '@/integrations/supabase/db-types'
import { planBalanceteCsvUpsert, type BalanceteCsvUpsertPlan } from '@/lib/balanceteCsvImport'
import { logger } from '../lib/logging'

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
  outcomes: BalanceteCsvCommitRowOutcome[]
}

export const balanceteCsvImportsRepoSupabase = {
  async commit(params: {
    originalFilename: string
    rows: BalanceteCsvCommitRow[]
    createdBy: string
  }): Promise<BalanceteCsvCommitResult> {
    const { originalFilename, rows, createdBy } = params

    if (rows.length === 0) {
      throw new Error('Nenhuma linha para importar')
    }

    const condominiumIds = Array.from(new Set(rows.map((row) => row.condominiumId)))

    const { data: condominiums, error: condominiumsError } = await supabase
      .from('omnia_condominiums')
      .select('id, balancete_digital')
      .in('id', condominiumIds)

    if (condominiumsError) {
      throw condominiumsError
    }

    const isDigitalById = new Map(
      (condominiums ?? []).map((condominium) => [condominium.id, condominium.balancete_digital === true])
    )

    const { data: existingBalancetes, error: existingError } = await supabase
      .from('omnia_balancetes')
      .select('id, condominium_id, competencia, received_at, digital_prepared_at')
      .in('condominium_id', condominiumIds)

    if (existingError) {
      throw existingError
    }

    const existingByKey = new Map(
      (existingBalancetes ?? []).map((balancete) => [
        `${balancete.condominium_id}::${balancete.competencia}`,
        balancete,
      ])
    )

    const { data: batchRow, error: batchInsertError } = await supabase
      .from('omnia_balancete_csv_import_batches')
      .insert({
        original_filename: originalFilename,
        total_rows: rows.length,
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
      const existing = existingByKey.get(`${row.condominiumId}::${row.competencia}`)
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

    return { batchId: batchRow.id, createdCount, updatedCount, noopCount, outcomes }
  },
}
