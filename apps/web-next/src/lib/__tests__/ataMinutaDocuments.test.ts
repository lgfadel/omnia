import { describe, expect, it } from 'vitest'
import { getMinutaDocumentValidationError } from '../ataMinuta'
import { getMinutaDocumentsTotalSize, getMinutaDocumentsValidationError } from '../ataMinutaDocuments'

describe('support PDF size validation', () => {
  it.each([26_214_401, 35_000_000, 47_185_920])('accepts a valid PDF of %i bytes', (size) => {
    expect(getMinutaDocumentValidationError({ name: 'apuracao.pdf', type: 'application/pdf', size })).toBeNull()
  })

  it('rejects a PDF one byte above 45 MiB', () => {
    expect(getMinutaDocumentValidationError({ name: 'apuracao.pdf', type: 'application/pdf', size: 47_185_921 })).toContain('45 MB')
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1, 0.5])('rejects an invalid file size of %s', (size) => {
    expect(getMinutaDocumentValidationError({ name: 'apuracao.pdf', type: 'application/pdf', size })).not.toBeNull()
  })
})

describe('combined support PDF budget', () => {
  it('accepts an ata without supporting PDFs', () => {
    expect(getMinutaDocumentsValidationError([])).toBeNull()
  })

  it('accepts an additional PDF exactly filling the combined budget', () => {
    expect(getMinutaDocumentsValidationError([{ sizeBytes: 30_000_000 }], 17_185_920)).toBeNull()
  })

  it('rejects an additional PDF exceeding the combined budget by one byte', () => {
    expect(getMinutaDocumentsValidationError([{ sizeBytes: 30_000_000 }], 17_185_921)).toContain('limite total de 45 MB')
  })

  it('rejects a stored set whose individual PDFs fit but total exceeds the budget', () => {
    expect(getMinutaDocumentsValidationError([{ sizeBytes: 24_000_000 }, { sizeBytes: 24_000_000 }])).toContain('limite total de 45 MB')
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 0.5])('rejects a stored PDF with invalid byte count %s', (sizeBytes) => {
    expect(getMinutaDocumentsValidationError([{ sizeBytes }])).toContain('inválido')
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 0.5])('rejects a prospective PDF with invalid byte count %s', (additionalSizeBytes) => {
    expect(getMinutaDocumentsValidationError([], additionalSizeBytes)).toContain('inválido')
  })

  it('reports the sum of the attached PDF sizes for the remaining-budget display', () => {
    expect(getMinutaDocumentsTotalSize([{ sizeBytes: 20_000_000 }, { sizeBytes: 10_000_000 }])).toBe(30_000_000)
  })
})
