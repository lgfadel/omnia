import Papa from 'papaparse'
import {
  matchCondominiumName,
  type CondominiumAliasMap,
  type CondominiumMatchCandidate,
  type CondominiumMatchSource,
} from './condominiumNameMatch'

export interface BalanceteCsvRow {
  rowNumber: number
  nomeCondominio: string
  competencia: string
  dataCriacaoIso: string
}

export interface BalanceteCsvRowError {
  rowNumber: number
  message: string
}

export interface ParsedBalancetesCsv {
  rows: BalanceteCsvRow[]
  errors: BalanceteCsvRowError[]
}

export function parseMesCompetencia(value: string): string | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value.trim())
  if (!match) return null

  const [, year, month] = match
  const monthNumber = Number(month)
  if (monthNumber < 1 || monthNumber > 12) return null

  return `${month}/${year}`
}

export function parseBalancetesCsv(csvText: string): ParsedBalancetesCsv {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  })

  const rows: BalanceteCsvRow[] = []
  const errors: BalanceteCsvRowError[] = []

  parsed.data.forEach((record, index) => {
    const rowNumber = index + 1
    const nomeCondominio = (record.nome_condominio ?? '').trim()
    const mesCompetencia = (record.mes_competencia ?? '').trim()
    const dataCriacaoIso = (record.data_criacao ?? '').trim()

    if (!nomeCondominio) {
      errors.push({ rowNumber, message: 'nome_condominio ausente' })
      return
    }

    const competencia = parseMesCompetencia(mesCompetencia)
    if (!competencia) {
      errors.push({ rowNumber, message: `competência inválida: "${mesCompetencia}"` })
      return
    }

    if (!dataCriacaoIso) {
      errors.push({ rowNumber, message: 'data_criacao ausente' })
      return
    }

    rows.push({ rowNumber, nomeCondominio, competencia, dataCriacaoIso })
  })

  return { rows, errors }
}

export interface BalanceteCsvPreviewRow {
  rowNumber: number
  nomeCondominioCsv: string
  competencia: string
  dataCriacaoIso: string
  condominiumId: string | null
  matchScore: number
  needsReview: boolean
  matchSource: CondominiumMatchSource
}

export interface BalanceteCsvImportPreview {
  rows: BalanceteCsvPreviewRow[]
  parseErrors: BalanceteCsvRowError[]
}

export function buildBalanceteCsvImportPreview(
  csvText: string,
  condominiums: CondominiumMatchCandidate[],
  aliases?: CondominiumAliasMap
): BalanceteCsvImportPreview {
  const { rows, errors } = parseBalancetesCsv(csvText)

  const previewRows: BalanceteCsvPreviewRow[] = []
  const parseErrors = [...errors]
  // Só linhas com match confiável entram na checagem aqui; sugestões em revisão
  // podem mudar de condomínio na UI e são checadas de novo antes de gravar.
  const firstRowByKey = new Map<string, BalanceteCsvPreviewRow>()

  for (const row of rows) {
    const match = matchCondominiumName(row.nomeCondominio, condominiums, aliases)
    const previewRow: BalanceteCsvPreviewRow = {
      rowNumber: row.rowNumber,
      nomeCondominioCsv: row.nomeCondominio,
      competencia: row.competencia,
      dataCriacaoIso: row.dataCriacaoIso,
      condominiumId: match.condominiumId,
      matchScore: match.score,
      needsReview: match.needsReview,
      matchSource: match.source,
    }

    if (previewRow.condominiumId && !previewRow.needsReview) {
      const key = balanceteRowKey(previewRow.condominiumId, previewRow.competencia)
      const firstRow = firstRowByKey.get(key)
      if (firstRow) {
        parseErrors.push({
          rowNumber: row.rowNumber,
          message: `linha duplicada no arquivo: a competência ${row.competencia} deste condomínio já está na linha ${firstRow.rowNumber}`,
        })
        continue
      }
      firstRowByKey.set(key, previewRow)
    }

    previewRows.push(previewRow)
  }

  parseErrors.sort((a, b) => a.rowNumber - b.rowNumber)

  return { rows: previewRows, parseErrors }
}

export function balanceteRowKey(condominiumId: string, competencia: string): string {
  return `${condominiumId}::${competencia}`
}

export function findDuplicateBalanceteKeys(rows: { condominiumId: string; competencia: string }[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  for (const row of rows) {
    const key = balanceteRowKey(row.condominiumId, row.competencia)
    if (seen.has(key)) duplicates.add(key)
    seen.add(key)
  }

  return Array.from(duplicates)
}

export interface BalanceteCsvUpsertExisting {
  receivedAt: string | null
  digitalPreparedAt: string | null
}

export interface BalanceteCsvUpsertParams {
  isDigitalCondominium: boolean
  dataCriacaoIso: string
  existing: BalanceteCsvUpsertExisting | null
}

export type BalanceteCsvUpsertPlan =
  | { action: 'noop' }
  | { action: 'create'; patch: { received_at: string | null; digital_prepared_at: string } }
  | { action: 'update'; patch: { received_at?: string; digital_prepared_at: string } }

export type BalanceteCsvRowStatus = 'new' | 'update' | 'unchanged'

const ROW_STATUS_BY_ACTION: Record<BalanceteCsvUpsertPlan['action'], BalanceteCsvRowStatus> = {
  create: 'new',
  update: 'update',
  noop: 'unchanged',
}

export function classifyBalanceteCsvRow(plan: BalanceteCsvUpsertPlan): BalanceteCsvRowStatus {
  return ROW_STATUS_BY_ACTION[plan.action]
}

/**
 * O CSV traz offset (`-03:00`) e o banco devolve TIMESTAMPTZ normalizado (`+00:00`):
 * a mesma data não é a mesma string. Comparamos o instante; valor ausente ou inválido
 * nunca conta como igual, para a linha cair em `update` em vez de um `noop` silencioso.
 */
function isSameInstant(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  const timeA = new Date(a).getTime()
  const timeB = new Date(b).getTime()
  return !Number.isNaN(timeA) && !Number.isNaN(timeB) && timeA === timeB
}

export function planBalanceteCsvUpsert(params: BalanceteCsvUpsertParams): BalanceteCsvUpsertPlan {
  const { isDigitalCondominium, dataCriacaoIso, existing } = params
  const receivedAtFromCsv = dataCriacaoIso.split('T')[0]

  if (isDigitalCondominium) {
    if (!existing) {
      return {
        action: 'create',
        patch: { received_at: receivedAtFromCsv, digital_prepared_at: dataCriacaoIso },
      }
    }

    const isAlreadySynced =
      existing.receivedAt === receivedAtFromCsv && isSameInstant(existing.digitalPreparedAt, dataCriacaoIso)
    if (isAlreadySynced) {
      return { action: 'noop' }
    }

    return {
      action: 'update',
      patch: { received_at: receivedAtFromCsv, digital_prepared_at: dataCriacaoIso },
    }
  }

  if (!existing) {
    return {
      action: 'create',
      patch: { received_at: null, digital_prepared_at: dataCriacaoIso },
    }
  }

  if (isSameInstant(existing.digitalPreparedAt, dataCriacaoIso)) {
    return { action: 'noop' }
  }

  return {
    action: 'update',
    patch: { digital_prepared_at: dataCriacaoIso },
  }
}
