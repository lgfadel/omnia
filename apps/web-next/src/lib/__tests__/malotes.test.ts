import { describe, expect, it } from 'vitest'
import {
  maloteItemStatusLabel,
  maloteSendProgress,
  renderMaloteTemplate,
  resolveMaloteContentType,
  summarizeMaloteBatch,
  validateMaloteFile,
  validateMaloteTemplate,
} from '@/lib/malotes'

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

describe('validateMaloteFile', () => {
  it('accepts any file type within the Gmail-safe limit', () => {
    const planilha = new File(['linha;valor'], 'prestacao.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const semExtensao = new File(['conteudo'], 'documento', { type: '' })

    expect(validateMaloteFile(planilha)).toEqual({ valid: true })
    expect(validateMaloteFile(semExtensao)).toEqual({ valid: true })
  })

  it('rejects an empty file', () => {
    const file = new File([], 'vazio.docx', { type: 'application/msword' })

    expect(validateMaloteFile(file)).toEqual({ valid: false, error: 'O arquivo vazio.docx está vazio.' })
  })

  it('rejects a file larger than the configured Gmail-safe limit', () => {
    const file = new File([new Uint8Array(18 * 1024 * 1024 + 1)], 'grande.zip', { type: 'application/zip' })

    expect(validateMaloteFile(file)).toEqual({
      valid: false,
      error: 'O arquivo grande.zip excede o limite de 18 MB.',
    })
  })

  it('rejects extensions that Gmail refuses to deliver', () => {
    const file = new File(['MZ'], 'instalador.exe', { type: 'application/octet-stream' })

    expect(validateMaloteFile(file)).toEqual({
      valid: false,
      error: 'O Gmail bloqueia anexos .exe. Compacte o arquivo com senha ou envie por link.',
    })
  })
})

describe('resolveMaloteContentType', () => {
  it('keeps a well-formed MIME type and drops its parameters', () => {
    expect(resolveMaloteContentType('text/csv; charset=utf-8')).toBe('text/csv')
  })

  it('falls back to a binary type when the browser reports nothing usable', () => {
    expect(resolveMaloteContentType('')).toBe('application/octet-stream')
    expect(resolveMaloteContentType('nao é um mime')).toBe('application/octet-stream')
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

describe('summarizeMaloteBatch', () => {
  it('prioritizes failures over any other state', () => {
    expect(summarizeMaloteBatch(['sent', 'failed', 'sending'])).toEqual({ label: 'Com falhas', tone: 'danger' })
  })

  it('reports progress while any attachment is still moving', () => {
    expect(summarizeMaloteBatch(['sent', 'sending'])).toEqual({ label: 'Em andamento', tone: 'progress' })
    expect(summarizeMaloteBatch(['pending'])).toEqual({ label: 'Em andamento', tone: 'progress' })
  })

  it('reports a delivered batch even when part of it was purged', () => {
    expect(summarizeMaloteBatch(['sent', 'purged'])).toEqual({ label: 'Enviado', tone: 'success' })
  })

  it('reports a fully purged batch and an empty one', () => {
    expect(summarizeMaloteBatch(['purged', 'purged'])).toEqual({ label: 'Expurgado', tone: 'neutral' })
    expect(summarizeMaloteBatch([])).toEqual({ label: 'Sem arquivos', tone: 'neutral' })
  })
})

describe('maloteItemStatusLabel', () => {
  it('translates every persisted status to Portuguese', () => {
    expect(maloteItemStatusLabel('sent')).toBe('Enviado')
    expect(maloteItemStatusLabel('failed')).toBe('Falhou')
    expect(maloteItemStatusLabel('sending')).toBe('Enviando')
  })

  it('falls back to the raw status for anything unmapped', () => {
    expect(maloteItemStatusLabel('desconhecido')).toBe('desconhecido')
  })
})

describe('maloteSendProgress', () => {
  it('conta upload e envio como metade do caminho cada', () => {
    expect(maloteSendProgress(0, 0, 4)).toBe(0)
    expect(maloteSendProgress(4, 0, 4)).toBe(50)
    expect(maloteSendProgress(4, 2, 4)).toBe(75)
    expect(maloteSendProgress(4, 4, 4)).toBe(100)
  })

  it('protege contra lote vazio e contagens fora da faixa', () => {
    expect(maloteSendProgress(0, 0, 0)).toBe(0)
    expect(maloteSendProgress(9, 9, 2)).toBe(100)
    expect(maloteSendProgress(-1, 0, 2)).toBe(0)
  })
})
