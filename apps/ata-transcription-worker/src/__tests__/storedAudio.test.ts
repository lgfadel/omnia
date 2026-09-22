import { describe, expect, it, vi } from 'vitest'
import { replaceStoredAudio } from '../storedAudio.js'

function harness(overrides: Partial<Parameters<typeof replaceStoredAudio>[0]> = {}) {
  const calls: string[] = []
  const options = {
    key: 'ata/job/Gravacao.wav',
    compactPath: '/tmp/work/audio.mp3',
    readCompacted: vi.fn(async () => { calls.push('read'); return Buffer.from('compacted') }),
    upload: vi.fn(async () => { calls.push('upload') }),
    remove: vi.fn(async () => { calls.push('remove') }),
    persist: vi.fn(async () => { calls.push('persist') }),
    ...overrides,
  }
  return { calls, options }
}

describe('replaceStoredAudio', () => {
  it('uploads the compacted audio before removing the original', async () => {
    const { calls, options } = harness()
    await replaceStoredAudio(options)
    expect(calls.indexOf('upload')).toBeLessThan(calls.indexOf('remove'))
  })

  it('records the new key, size and mime type before the original is removed', async () => {
    const { calls, options } = harness()
    const result = await replaceStoredAudio(options)
    expect(options.persist).toHaveBeenCalledWith({
      storagePath: 'ata/job/Gravacao.compacted.mp3',
      sizeBytes: Buffer.from('compacted').byteLength,
      mimeType: 'audio/mpeg',
    })
    expect(calls.indexOf('persist')).toBeLessThan(calls.indexOf('remove'))
    expect(result).toMatchObject({ replaced: true, storagePath: 'ata/job/Gravacao.compacted.mp3' })
  })

  it('keeps the original when the upload fails', async () => {
    const { options } = harness({ upload: vi.fn(async () => { throw new Error('R2 is unreachable.') }) })
    await expect(replaceStoredAudio(options)).rejects.toThrow('R2 is unreachable.')
    expect(options.persist).not.toHaveBeenCalled()
    expect(options.remove).not.toHaveBeenCalled()
  })

  it('keeps the original when the job row cannot be updated', async () => {
    const { options } = harness({ persist: vi.fn(async () => { throw new Error('Database rejected the update.') }) })
    await expect(replaceStoredAudio(options)).rejects.toThrow('Database rejected the update.')
    expect(options.remove).not.toHaveBeenCalled()
  })

  it('succeeds when the original cannot be removed, since the job already points at the compacted audio', async () => {
    const { options } = harness({ remove: vi.fn(async () => { throw new Error('Delete failed.') }) })
    await expect(replaceStoredAudio(options)).resolves.toMatchObject({ replaced: true })
  })

  it('does nothing when the compacted audio is not smaller than the original', async () => {
    const { options } = harness({ readCompacted: vi.fn(async () => Buffer.alloc(2048)) })
    const result = await replaceStoredAudio({ ...options, originalSizeBytes: 1024 })
    expect(result).toMatchObject({ replaced: false })
    expect(options.upload).not.toHaveBeenCalled()
    expect(options.remove).not.toHaveBeenCalled()
  })

  it('leaves the stored audio untouched when it is already the compacted object', async () => {
    const { options } = harness({ key: 'ata/job/Gravacao.compacted.mp3' })
    const result = await replaceStoredAudio(options)
    expect(result).toMatchObject({ replaced: false, reason: 'already-compacted' })
    expect(options.upload).not.toHaveBeenCalled()
    expect(options.remove).not.toHaveBeenCalled()
  })

  // Um MP3 vindo do gravador compartilha extensão e mime type com o objeto que
  // este módulo produz, mas continua sendo o arquivo integral do usuário.
  it('compacts an mp3 sent by the user, which is not a compacted object', async () => {
    const { options } = harness({ key: 'ata/job/Assembleia.mp3' })
    const result = await replaceStoredAudio({ ...options, originalSizeBytes: 300_000_000 })
    expect(result).toMatchObject({ replaced: true, storagePath: 'ata/job/Assembleia.compacted.mp3' })
    expect(options.remove).toHaveBeenCalledWith('ata/job/Assembleia.mp3')
  })
})
