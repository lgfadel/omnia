import { describe, expect, it, vi } from 'vitest'
import { commitCompactedAudio, compactedKeyFor, isCompactedKey } from '../storedAudio.js'

function harness(overrides: Partial<Parameters<typeof commitCompactedAudio>[0]> = {}) {
  const calls: string[] = []
  const options = {
    key: 'ata/job/Gravacao.wav',
    sizeBytes: 9,
    originalSizeBytes: 1000,
    complete: vi.fn(async () => { calls.push('complete') }),
    abort: vi.fn(async () => { calls.push('abort') }),
    persist: vi.fn(async () => { calls.push('persist') }),
    remove: vi.fn(async () => { calls.push('remove') }),
    ...overrides,
  }
  return { calls, options }
}

describe('compactedKeyFor / isCompactedKey', () => {
  it('marks the object produced here so it is never compacted twice', () => {
    expect(compactedKeyFor('ata/job/Gravacao.wav')).toBe('ata/job/Gravacao.compacted.mp3')
    expect(isCompactedKey('ata/job/Gravacao.compacted.mp3')).toBe(true)
  })

  // Um MP3 vindo do gravador compartilha extensão e mime type com o objeto que
  // este módulo produz, mas continua sendo o arquivo integral do usuário.
  it('does not mistake an mp3 sent by the user for a compacted object', () => {
    expect(isCompactedKey('ata/job/Assembleia.mp3')).toBe(false)
    expect(compactedKeyFor('ata/job/Assembleia.mp3')).toBe('ata/job/Assembleia.compacted.mp3')
  })
})

describe('commitCompactedAudio', () => {
  it('completes the upload and records it before removing the original', async () => {
    const { calls, options } = harness()
    const result = await commitCompactedAudio(options)
    expect(calls).toEqual(['complete', 'persist', 'remove'])
    expect(options.persist).toHaveBeenCalledWith({ storagePath: 'ata/job/Gravacao.compacted.mp3', sizeBytes: 9, mimeType: 'audio/mpeg' })
    expect(options.remove).toHaveBeenCalledWith('ata/job/Gravacao.wav')
    expect(result).toEqual({ replaced: true, storagePath: 'ata/job/Gravacao.compacted.mp3', sizeBytes: 9 })
  })

  it('keeps the original when the upload cannot be completed', async () => {
    const { options } = harness({ complete: vi.fn(async () => { throw new Error('R2 is unreachable.') }) })
    await expect(commitCompactedAudio(options)).rejects.toThrow('R2 is unreachable.')
    expect(options.persist).not.toHaveBeenCalled()
    expect(options.remove).not.toHaveBeenCalled()
  })

  // O objeto compactado já existe, mas nenhum job aponta para ele: sem a
  // limpeza, ficaria órfão no bucket para sempre.
  it('keeps the original and drops the orphaned compacted object when the job row cannot be updated', async () => {
    const { options } = harness({ persist: vi.fn(async () => { throw new Error('Database rejected the update.') }) })
    await expect(commitCompactedAudio(options)).rejects.toThrow('Database rejected the update.')
    expect(options.remove).toHaveBeenCalledTimes(1)
    expect(options.remove).toHaveBeenCalledWith('ata/job/Gravacao.compacted.mp3')
  })

  it('succeeds when the original cannot be removed, since the job already points at the compacted audio', async () => {
    const { options } = harness({ remove: vi.fn(async () => { throw new Error('Delete failed.') }) })
    await expect(commitCompactedAudio(options)).resolves.toMatchObject({ replaced: true })
  })

  it('abandons the upload when the compacted audio is not smaller than the original', async () => {
    const { calls, options } = harness({ sizeBytes: 2048, originalSizeBytes: 1024 })
    const result = await commitCompactedAudio(options)
    expect(result).toEqual({ replaced: false, reason: 'not-smaller' })
    expect(calls).toEqual(['abort'])
  })
})
