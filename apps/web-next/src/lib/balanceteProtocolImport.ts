export type ProtocolImportConfidence = 'high' | 'medium' | 'low'

export interface ProtocolImportModelOutput {
  protocolNumber: number | null
  confidence: ProtocolImportConfidence
  found: boolean
}

export interface ImportedProtocolPageContext {
  pageNumber: number
  detection: ProtocolImportModelOutput
  protocolosByNumber: Map<number, { id: string; numero: number }>
  balancetesByProtocoloId: Map<string, Array<{ id: string; protocolo_id?: string | null }>>
  attachedBalanceteIds: Set<string>
}

export type ImportedProtocolPageResolution =
  | {
      status: 'matched'
      pageNumber: number
      protocolNumber: number
      protocoloId: string
      balanceteId: string
      attachedBalanceteIds: string[]
      confidence: ProtocolImportConfidence
    }
  | {
      status: 'not_found'
      pageNumber: number
      confidence: ProtocolImportConfidence
    }
  | {
      status: 'protocol_not_found'
      pageNumber: number
      protocolNumber: number
      confidence: ProtocolImportConfidence
    }
  | {
      status: 'multiple_matches'
      pageNumber: number
      protocolNumber: number
      protocoloId: string
      candidateBalanceteIds: string[]
      confidence: ProtocolImportConfidence
    }
  | {
      status: 'already_attached'
      pageNumber: number
      protocolNumber: number
      protocoloId: string
      balanceteId: string
      attachedBalanceteIds: string[]
      confidence: ProtocolImportConfidence
    }

const CONFIDENCE_VALUES = new Set<ProtocolImportConfidence>(['high', 'medium', 'low'])

export function parseProtocolImportModelOutput(raw: string): ProtocolImportModelOutput {
  const parsed = JSON.parse(raw) as {
    protocol_number?: unknown
    confidence?: unknown
    found?: unknown
  }

  const protocolNumber =
    typeof parsed.protocol_number === 'number' && Number.isFinite(parsed.protocol_number)
      ? parsed.protocol_number
      : null

  const confidence = CONFIDENCE_VALUES.has(parsed.confidence as ProtocolImportConfidence)
    ? (parsed.confidence as ProtocolImportConfidence)
    : 'low'

  const found = parsed.found === true && protocolNumber !== null

  return {
    protocolNumber,
    confidence,
    found,
  }
}

export function resolveImportedProtocolPage(
  context: ImportedProtocolPageContext
): ImportedProtocolPageResolution {
  const { detection, pageNumber, protocolosByNumber, balancetesByProtocoloId, attachedBalanceteIds } = context

  if (!detection.found || detection.protocolNumber === null) {
    return {
      status: 'not_found',
      pageNumber,
      confidence: detection.confidence,
    }
  }

  const protocolo = protocolosByNumber.get(detection.protocolNumber)

  if (!protocolo) {
    return {
      status: 'protocol_not_found',
      pageNumber,
      protocolNumber: detection.protocolNumber,
      confidence: detection.confidence,
    }
  }

  const balancetes = balancetesByProtocoloId.get(protocolo.id) ?? []
  const eligibleBalancetes = balancetes.filter(
    (balancete) => !attachedBalanceteIds.has(balancete.id)
  )
  const protocoloBalanceteIds = balancetes.map((balancete) => balancete.id)

  if (eligibleBalancetes.length === 0 && balancetes.length > 0) {
    return {
      status: 'already_attached',
      pageNumber,
      protocolNumber: detection.protocolNumber,
      protocoloId: protocolo.id,
      balanceteId: balancetes[0].id,
      attachedBalanceteIds: protocoloBalanceteIds,
      confidence: detection.confidence,
    }
  }

  if (eligibleBalancetes.length === 0) {
    return {
      status: 'multiple_matches',
      pageNumber,
      protocolNumber: detection.protocolNumber,
      protocoloId: protocolo.id,
      candidateBalanceteIds: eligibleBalancetes.map((balancete) => balancete.id),
      confidence: detection.confidence,
    }
  }

  const [balancete] = eligibleBalancetes

  return {
    status: 'matched',
    pageNumber,
    protocolNumber: detection.protocolNumber,
    protocoloId: protocolo.id,
    balanceteId: balancete.id,
    attachedBalanceteIds: eligibleBalancetes.map((candidate) => candidate.id),
    confidence: detection.confidence,
  }
}
