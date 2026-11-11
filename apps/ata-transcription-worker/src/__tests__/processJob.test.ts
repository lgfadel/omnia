import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { writeFile } from 'node:fs/promises'
const mocks = vi.hoisted(() => ({ duration: vi.fn(), extract: vi.fn(), compact: vi.fn() }))
vi.mock('../audio.js', () => ({ readAudioDuration: mocks.duration, extractChunk: mocks.extract }))
vi.mock('../compactedUpload.js', () => ({ createCompactedUpload: mocks.compact }))
vi.mock('../ataContext.js', () => ({ loadAtaContext: async () => ({ prompt: 'context', keywords: ['nome'] }) }))
vi.mock('../r2.js', () => ({ presignR2Get: async (_c: unknown, _b: unknown, key: string) => key, deleteR2Object: vi.fn(async () => {}) }))
import { deleteR2Object } from '../r2.js'
import { processJob, type TranscriptionJob } from '../processJob.js'
const job = { id: 'job', ata_id: 'ata', storage_path: 'legacy', storage_provider: 'r2', size_bytes: 10000, mime_type: 'audio/wav', status: 'processing', attempt_count: 0, context_text: null } as TranscriptionJob
function harness(files: any[] = []) {
  const updates: any[] = [], transcripts: any[] = [], rpcs: any[] = []
  const state = { queryError: null as any, persistError: null as any, rpcError: null as any, current: true }
  const db = { from(table: string) {
    let upsert: any
    const query: any = {
      select: () => query, eq: () => query, order: () => query, delete: () => query,
      update: (value: any) => { updates.push(value); return query },
      upsert: (value: any) => { upsert = value; transcripts.push(value); return query },
      then: (resolve: any) => resolve({ data: table.endsWith('_files') ? files : null, error: table.endsWith('_files') ? state.queryError : null }),
      maybeSingle: async () => ({ data: state.current ? { id: 'job' } : null, error: null }),
      single: async () => ({ data: { id: 'transcript' }, error: upsert ? state.persistError : null }),
    }; return query
  }, rpc: async (name: string, args: any) => { rpcs.push({ name, args }); return { data: null, error: state.rpcError } } }
  const provider = vi.fn(async (_request: any) => ({ text: 'A mesma frase completa repetida.', usage: { seconds: 1 } }))
  return { db, provider, updates, transcripts, rpcs, state, run: () => processJob(job, db as any, { audio: { transcriptions: { create: provider } } } as any, { client: {} as any, bucket: 'audio' }) }
}
const files = ['z.wav', 'a.mp4', 'm.webm'].map((name, index) => ({ id: String(index), job_id: 'job', position: index + 1, original_filename: name, storage_path: name, storage_provider: 'r2', size_bytes: 10000, mime_type: ['audio/wav', 'video/mp4', 'audio/webm'][index] }))
beforeEach(() => { vi.clearAllMocks(); vi.spyOn(console, 'error').mockImplementation(() => {}); mocks.duration.mockResolvedValue(10); mocks.extract.mockImplementation(async (_url, _window, path) => writeFile(path, 'chunk')); mocks.compact.mockReturnValue(null) })
afterEach(() => vi.restoreAllMocks())
it('processes mixed sources in position order, preserves boundary repeats and global carryover/progress', async () => {
  const h = harness([files[2], files[0], files[1]])
  await h.run()
  expect(mocks.duration.mock.calls.map(c => c[0])).toEqual(['z.wav', 'a.mp4', 'm.webm'])
  expect(mocks.extract.mock.calls.map(c => c[0])).toEqual(['z.wav', 'a.mp4', 'm.webm'])
  expect(h.provider.mock.calls).toHaveLength(3)
  expect((h.provider.mock.calls[1] as any)[0].prompt).toContain('Continuação de:')
  expect(h.updates.filter(u => u.processed_chunks > 0).map(u => u.processed_chunks)).toEqual([1, 2, 3])
  expect(h.transcripts[0].raw_text).toBe(Array(3).fill('A mesma frase completa repetida.').join('\n\n'))
})
it('validates total actual duration before requesting provider', async () => {
  mocks.duration.mockResolvedValue(8000); const h = harness(files)
  await expect(h.run()).rejects.toThrow('duration')
  expect(mocks.duration).toHaveBeenCalledTimes(3); expect(h.provider).not.toHaveBeenCalled(); expect(h.transcripts).toEqual([])
})
it.each([0, NaN, Infinity])('rejects invalid actual duration %s', async duration => {
  mocks.duration.mockResolvedValue(duration); const h = harness(files)
  await expect(h.run()).rejects.toThrow('duration'); expect(h.provider).not.toHaveBeenCalled()
})
it('fails a middle source without publishing a partial transcript and aborts all uploads', async () => {
  const abort = vi.fn(async () => {}); mocks.compact.mockImplementation(() => ({ addPart: async () => {}, sizeBytes: 5, abort, complete: async () => {} }))
  const h = harness(files); h.provider.mockResolvedValueOnce({ text: 'primeiro', usage: { seconds: 1 } }).mockRejectedValueOnce(new Error('middle'))
  await expect(h.run()).rejects.toThrow('middle'); expect(h.transcripts).toEqual([]); expect(abort).toHaveBeenCalledTimes(3)
})
it('uses parent source for a legacy job, but fails source query errors', async () => {
  const h = harness(); await h.run(); expect(mocks.duration).toHaveBeenCalledWith('legacy')
  const failed = harness(); failed.state.queryError = new Error('query'); await expect(failed.run()).rejects.toThrow('query')
})
it('commits compaction by file RPC only after unified transcript persistence', async () => {
  const completed: string[] = []
  mocks.compact.mockImplementation(({ storagePath }) => ({ addPart: async () => {}, sizeBytes: 5, abort: async () => {}, complete: async () => { completed.push(storagePath) } }))
  const h = harness(files); await h.run()
  expect(completed).toEqual(['z.wav', 'a.mp4', 'm.webm'])
  expect(h.rpcs.map(r => r.args.p_file_id)).toEqual(['0', '1', '2'])
  expect(h.rpcs.every(r => r.name === 'omnia_commit_ata_transcription_file')).toBe(true)
  const failed = harness(files); failed.state.persistError = new Error('persist'); completed.length = 0
  await expect(failed.run()).rejects.toThrow('persist'); expect(completed).toEqual([]); expect(failed.rpcs).toEqual([])
})

it('merges chunk repeats within each file while keeping global chunk indices monotonic', async () => {
  mocks.duration.mockResolvedValue(1801)
  const h = harness(files.slice(0, 2)); await h.run()
  expect(mocks.extract.mock.calls.map(c => [c[0], c[1].startSeconds])).toEqual([['z.wav', 0], ['z.wav', 1800], ['a.mp4', 0], ['a.mp4', 1800]])
  expect(h.updates.filter(u => u.processed_chunks > 0).map(u => u.processed_chunks)).toEqual([1, 2, 3, 4])
  expect(h.transcripts[0].raw_text).toBe('A mesma frase completa repetida.\n\nA mesma frase completa repetida.')
})
it('checks current lease before and after provider requests', async () => {
  const before = harness(files); before.state.current = false
  await expect(before.run()).rejects.toThrow('before chunk'); expect(before.provider).not.toHaveBeenCalled()
  const during = harness(files)
  during.provider.mockImplementationOnce(async () => { during.state.current = false; return { text: 'obsolete', usage: { seconds: 1 } } })
  await expect(during.run()).rejects.toThrow('during chunk'); expect(during.transcripts).toEqual([])
})
it('keeps original objects on RPC persistence failure and cleans new objects only', async () => {
  const abort = vi.fn(async () => {})
  mocks.compact.mockImplementation(() => ({ addPart: async () => {}, sizeBytes: 5, abort, complete: async () => {} }))
  const h = harness(files); h.state.rpcError = new Error('compaction persist'); await h.run()
  expect(h.updates.at(-1).status).toBe('completed')
  expect(vi.mocked(deleteR2Object).mock.calls.map(c => c[2])).toEqual(['z.compacted.mp3', 'a.compacted.mp3', 'm.compacted.mp3'])
})
it('does not abort successfully committed uploads', async () => {
  const abort = vi.fn(async () => {})
  mocks.compact.mockImplementation(() => ({ addPart: async () => {}, sizeBytes: 5, abort, complete: async () => {} }))
  await harness(files).run()
  expect(abort).not.toHaveBeenCalled()
})
