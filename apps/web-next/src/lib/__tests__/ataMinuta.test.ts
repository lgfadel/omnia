import { describe, expect, it } from 'vitest'
import {
  buildMinutaResponsesInput,
  canAccessMinuta,
  diffMinutaSections,
  getMinutaDocumentValidationError,
  MINUTA_DOCUMENT_MAX_SIZE_BYTES,
  parseMinutaSections,
  type MinutaGenerationContext,
} from '../ataMinuta'

describe('canAccessMinuta', () => {
  it('allows an ADMIN regardless of who is responsible for the ata', () => {
    expect(canAccessMinuta({ roles: ['ADMIN'], omniaUserId: 'u1' }, { responsibleId: 'someone-else' })).toBe(true)
  })

  it('allows a SECRETARIO regardless of who is responsible for the ata', () => {
    expect(canAccessMinuta({ roles: ['SECRETARIO'], omniaUserId: 'u1' }, { responsibleId: 'someone-else' })).toBe(true)
  })

  it('allows the responsible user even without a privileged role', () => {
    expect(canAccessMinuta({ roles: ['USUARIO'], omniaUserId: 'u1' }, { responsibleId: 'u1' })).toBe(true)
  })

  it('denies a plain user who is not responsible for the ata', () => {
    expect(canAccessMinuta({ roles: ['USUARIO'], omniaUserId: 'u1' }, { responsibleId: 'someone-else' })).toBe(false)
  })

  it('denies a plain user when the ata has no responsible assigned', () => {
    expect(canAccessMinuta({ roles: ['USUARIO'], omniaUserId: 'u1' }, { responsibleId: null })).toBe(false)
  })
})

describe('parseMinutaSections', () => {
  it('splits content by "## " headings into title and body', () => {
    const content = '## Prestação de contas\nParágrafo um.\nParágrafo dois.\n\n## Eleição do síndico\nOutro parágrafo.'
    expect(parseMinutaSections(content)).toEqual([
      { title: 'Prestação de contas', body: 'Parágrafo um.\nParágrafo dois.' },
      { title: 'Eleição do síndico', body: 'Outro parágrafo.' },
    ])
  })

  it('keeps leading text without a heading as an untitled section', () => {
    const content = 'Texto sem título ainda.\n\n## Pauta 1\nCorpo.'
    expect(parseMinutaSections(content)).toEqual([
      { title: '', body: 'Texto sem título ainda.' },
      { title: 'Pauta 1', body: 'Corpo.' },
    ])
  })

  it('returns an empty list for empty content', () => {
    expect(parseMinutaSections('')).toEqual([])
  })
})

describe('diffMinutaSections', () => {
  it('reports only the sections whose body actually changed', () => {
    const before = '## Um\nA.\n\n## Dois\nB.'
    const after = '## Um\nA.\n\n## Dois\nB revisado.'
    expect(diffMinutaSections(before, after)).toEqual({ changedTitles: ['Dois'], unchangedCount: 1 })
  })

  it('counts a new section title as changed', () => {
    const before = '## Um\nA.'
    const after = '## Um\nA.\n\n## Dois\nNovo.'
    expect(diffMinutaSections(before, after)).toEqual({ changedTitles: ['Dois'], unchangedCount: 1 })
  })

  it('reports nothing changed when the content is identical', () => {
    const content = '## Um\nA.\n\n## Dois\nB.'
    expect(diffMinutaSections(content, content)).toEqual({ changedTitles: [], unchangedCount: 2 })
  })
})

describe('getMinutaDocumentValidationError', () => {
  it('accepts a PDF within the size limit', () => {
    expect(getMinutaDocumentValidationError({ name: 'apuracao.pdf', type: 'application/pdf', size: 1024 })).toBeNull()
  })

  it('rejects a non-PDF file', () => {
    expect(getMinutaDocumentValidationError({ name: 'apuracao.docx', type: 'application/msword', size: 1024 }))
      .toBe('Formato não suportado. Envie um PDF.')
  })

  it('rejects a file over the size limit', () => {
    expect(getMinutaDocumentValidationError({ name: 'apuracao.pdf', type: 'application/pdf', size: MINUTA_DOCUMENT_MAX_SIZE_BYTES + 1 }))
      .toBe('O arquivo ultrapassa o limite de 25 MB.')
  })

  it('rejects an empty file', () => {
    expect(getMinutaDocumentValidationError({ name: 'apuracao.pdf', type: 'application/pdf', size: 0 }))
      .toBe('Este arquivo está vazio.')
  })
})

describe('buildMinutaResponsesInput', () => {
  const baseContext: MinutaGenerationContext = {
    ataTitle: 'Assembleia Geral Ordinária',
    condominiumName: 'Edifício Tapuias',
    meetingDate: '2026-08-15',
    transcriptionText: 'Texto transcrito da assembleia.',
    convocacaoContextText: 'Pauta: prestação de contas.',
    documents: [{ originalFilename: 'apuracao.pdf', base64: 'QUJD' }],
  }

  it('builds a developer message and a single user message for a fresh generation', () => {
    const input = buildMinutaResponsesInput('Você é o secretário.', baseContext)
    expect(input).toHaveLength(2)
    expect(input[0]).toEqual({ role: 'developer', content: [{ type: 'input_text', text: 'Você é o secretário.' }] })
    expect(input[1].role).toBe('user')
    expect(input[1].content[0]).toMatchObject({ type: 'input_text' })
    const contextText = (input[1].content[0] as { text: string }).text
    expect(contextText).toContain('Assembleia Geral Ordinária')
    expect(contextText).toContain('Edifício Tapuias')
    expect(contextText).toContain('Texto transcrito da assembleia.')
  })

  it('includes each PDF as an input_file with a base64 data URL', () => {
    const input = buildMinutaResponsesInput('prompt', baseContext)
    const filePart = input[1].content.find((part) => part.type === 'input_file')
    expect(filePart).toEqual({ type: 'input_file', filename: 'apuracao.pdf', file_data: 'data:application/pdf;base64,QUJD' })
  })

  it('omits the convocação block when there is no context text', () => {
    const input = buildMinutaResponsesInput('prompt', { ...baseContext, convocacaoContextText: undefined })
    const texts = input[1].content.filter((part) => part.type === 'input_text').map((part) => (part as { text: string }).text)
    expect(texts.some((text) => text.startsWith('Convocação'))).toBe(false)
  })

  it('appends the current minuta as an assistant turn and the instruction as the final user turn', () => {
    const input = buildMinutaResponsesInput('prompt', {
      ...baseContext,
      currentContent: '## Prestação de contas\nTexto atual.',
      priorInstructions: [],
      instruction: 'Remova valores em reais da seção 1.',
    })
    expect(input).toHaveLength(4)
    expect(input[2].role).toBe('assistant')
    expect(input[2].content[0]).toEqual({ type: 'output_text', text: '## Prestação de contas\nTexto atual.' })
    expect(input[3].role).toBe('user')
    expect((input[3].content[0] as { text: string }).text).toContain('Remova valores em reais da seção 1.')
  })

  it('lists prior instructions before the new one, without replaying assistant turns per instruction', () => {
    const input = buildMinutaResponsesInput('prompt', {
      ...baseContext,
      currentContent: 'conteúdo atual',
      priorInstructions: ['Corrija o nome do síndico.', 'Remova o segundo parágrafo.'],
      instruction: 'Deixe mais formal.',
    })
    expect(input).toHaveLength(5)
    const historyText = (input[3].content[0] as { text: string }).text
    expect(historyText).toContain('1. Corrija o nome do síndico.')
    expect(historyText).toContain('2. Remova o segundo parágrafo.')
    expect((input[4].content[0] as { text: string }).text).toContain('Deixe mais formal.')
  })
})
