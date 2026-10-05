import {
  balanceteRowKey,
  classifyBalanceteCsvRow,
  findDuplicateBalanceteKeys,
  planBalanceteCsvUpsert,
  type BalanceteCsvPreviewRow,
  type BalanceteCsvRowStatus,
} from './balanceteCsvImport'

/**
 * Estado de uma linha do CSV durante a revisão.
 * - `confirmed`: o condomínio da linha está resolvido (match confiável, alias, ou o usuário confirmou).
 * - `userConfirmed`: o usuário confirmou/escolheu explicitamente; só isso gera alias para as próximas importações.
 */
export interface BalanceteCsvReviewRow extends BalanceteCsvPreviewRow {
  selectedCondominiumId: string
  confirmed: boolean
  userConfirmed: boolean
  ignored: boolean
}

export type BalanceteCsvReviewGroup = 'pending' | 'write' | 'unchanged'

export interface BalanceteCsvReviewRowView {
  row: BalanceteCsvReviewRow
  group: BalanceteCsvReviewGroup
  /** null enquanto não há condomínio selecionado. */
  status: BalanceteCsvRowStatus | null
}

export interface ExistingBalanceteSnapshot {
  received_at: string | null
  digital_prepared_at: string | null
}

export interface BalanceteCsvReviewContext {
  isDigitalCondominium: (condominiumId: string) => boolean
  /** Chave `balanceteRowKey(condominiumId, competencia)`. */
  existingByKey: ReadonlyMap<string, ExistingBalanceteSnapshot>
}

export interface BalanceteCsvReviewSummary {
  /** Linhas ativas que ainda bloqueiam a importação por falta de confirmação do condomínio. */
  pendingCount: number
  writeRows: BalanceteCsvReviewRowView[]
  unchangedCount: number
  ignoredCount: number
  aliasesToSave: { condominiumId: string; aliasOriginal: string }[]
  duplicateKeys: string[]
}

export function createReviewRows(previewRows: BalanceteCsvPreviewRow[]): BalanceteCsvReviewRow[] {
  return previewRows.map((row) => ({
    ...row,
    selectedCondominiumId: row.condominiumId ?? '',
    confirmed: row.condominiumId !== null && !row.needsReview,
    userConfirmed: false,
    ignored: false,
  }))
}

export function buildReviewRowViews(
  rows: BalanceteCsvReviewRow[],
  context: BalanceteCsvReviewContext
): BalanceteCsvReviewRowView[] {
  return rows.map((row) => {
    if (!row.selectedCondominiumId) {
      return { row, group: 'pending', status: null }
    }

    const existing = context.existingByKey.get(balanceteRowKey(row.selectedCondominiumId, row.competencia))
    const plan = planBalanceteCsvUpsert({
      isDigitalCondominium: context.isDigitalCondominium(row.selectedCondominiumId),
      dataCriacaoIso: row.dataCriacaoIso,
      existing: existing
        ? { receivedAt: existing.received_at, digitalPreparedAt: existing.digital_prepared_at }
        : null,
    })
    const status = classifyBalanceteCsvRow(plan)

    if (!row.confirmed) return { row, group: 'pending', status }
    return { row, group: status === 'unchanged' ? 'unchanged' : 'write', status }
  })
}

export function summarizeReview(views: BalanceteCsvReviewRowView[]): BalanceteCsvReviewSummary {
  const active = views.filter((view) => !view.row.ignored)
  const writeRows = active.filter((view) => view.group === 'write')

  return {
    pendingCount: active.filter((view) => view.group === 'pending').length,
    writeRows,
    unchangedCount: active.filter((view) => view.group === 'unchanged').length,
    ignoredCount: views.length - active.length,
    aliasesToSave: active
      .filter((view) => view.row.userConfirmed && view.row.selectedCondominiumId)
      .map((view) => ({
        condominiumId: view.row.selectedCondominiumId,
        aliasOriginal: view.row.nomeCondominioCsv,
      })),
    duplicateKeys: findDuplicateBalanceteKeys(
      writeRows.map((view) => ({
        condominiumId: view.row.selectedCondominiumId,
        competencia: view.row.competencia,
      }))
    ),
  }
}
