import Papa from 'papaparse'
import { matchCondominiumName, type CondominiumMatchCandidate } from './condominiumNameMatch'

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
}

export interface BalanceteCsvImportPreview {
  rows: BalanceteCsvPreviewRow[]
  parseErrors: BalanceteCsvRowError[]
}

export function buildBalanceteCsvImportPreview(
  csvText: string,
  condominiums: CondominiumMatchCandidate[]
): BalanceteCsvImportPreview {
  const { rows, errors } = parseBalancetesCsv(csvText)

  const previewRows = rows.map((row) => {
    const match = matchCondominiumName(row.nomeCondominio, condominiums)

    return {
      rowNumber: row.rowNumber,
      nomeCondominioCsv: row.nomeCondominio,
      competencia: row.competencia,
      dataCriacaoIso: row.dataCriacaoIso,
      condominiumId: match.condominiumId,
      matchScore: match.score,
      needsReview: match.needsReview,
    }
  })

  return { rows: previewRows, parseErrors: errors }
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
      existing.receivedAt === receivedAtFromCsv && existing.digitalPreparedAt === dataCriacaoIso
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

  if (existing.digitalPreparedAt === dataCriacaoIso) {
    return { action: 'noop' }
  }

  return {
    action: 'update',
    patch: { digital_prepared_at: dataCriacaoIso },
  }
}
