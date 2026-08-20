import { describe, expect, it } from 'vitest'
import { renderMaloteTemplate, validateMalotePdf, validateMaloteTemplate } from '@/lib/malotes'

describe('renderMaloteTemplate', () => {
  it('renders the condominium, date, and attachment name for one email', () => {
    expect(renderMaloteTemplate(
      'Prezados,\n\nSegue {{arquivo}} do {{condominio}} em {{data_envio}}.',
      { condominium: 'Condomínio Aurora', fileName: 'prestacao.pdf', sentAt: new Date('2026-08-20T12:00:00-03:00') },
    )).toBe('Prezados,\n\nSegue prestacao.pdf do Condomínio Aurora em 20/08/2026.')
  })

  it('renders variables with whitespace accepted by template validation', () => {
    expect(renderMaloteTemplate('{{ condominio }}', {
      condominium: 'Condomínio Aurora', fileName: 'prestacao.pdf', sentAt: new Date('2026-08-20T12:00:00-03:00'),
    })).toBe('Condomínio Aurora')
  })
})

describe('validateMalotePdf', () => {
  it('accepts a PDF with a valid extension, MIME type, and signature', async () => {
    const file = new File(['%PDF-1.7 valid'], 'prestacao.pdf', { type: 'application/pdf' })

    await expect(validateMalotePdf(file)).resolves.toEqual({ valid: true })
  })

  it('rejects a file that only pretends to be a PDF', async () => {
    const file = new File(['not a pdf'], 'prestacao.pdf', { type: 'application/pdf' })

    await expect(validateMalotePdf(file)).resolves.toEqual({
      valid: false,
      error: 'O arquivo prestacao.pdf não possui uma assinatura PDF válida.',
    })
  })

  it('rejects a PDF larger than the configured Gmail-safe limit', async () => {
    const file = new File(['%PDF-', new Uint8Array(18 * 1024 * 1024)], 'grande.pdf', { type: 'application/pdf' })

    await expect(validateMalotePdf(file)).resolves.toEqual({
      valid: false,
      error: 'O arquivo grande.pdf excede o limite de 18 MB.',
    })
  })
})

describe('validateMaloteTemplate', () => {
  it('rejects unsupported variables before a batch is created', () => {
    expect(validateMaloteTemplate('Olá {{sindico}}')).toEqual({
      valid: false,
      error: 'A variável {{sindico}} não é permitida em malotes.',
    })
  })
})
