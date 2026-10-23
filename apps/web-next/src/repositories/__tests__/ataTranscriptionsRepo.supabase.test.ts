import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ataTranscriptionsRepoSupabase } from '../ataTranscriptionsRepo.supabase'

vi.mock('@/integrations/supabase/client', async () => {
  const { createClient } = await vi.importActual<typeof import('@supabase/supabase-js')>('@supabase/supabase-js')
  return { supabase: createClient('https://supabase.test', 'test-anon-key', { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }) }
})

let requests: Array<{ path: string; body: Record<string, unknown> | null }>
let failure: boolean
beforeEach(() => {
  requests = []
  failure = false
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input))
    const path = url.pathname
    requests.push({ path, body: init.body ? JSON.parse(String(init.body)) : null })
    const data = path === '/functions/v1/ata-transcriptions'
      ? failure ? { error: 'A transcrição atual mudou.' } : { jobId: 'job-1' }
      : path.endsWith('/omnia_ata_transcription_jobs')
        ? { id: 'job-1', ata_id: 'ata-1', source_type: 'text_import', status: 'completed', original_filename: 'zoom.vtt', attempt_count: 0, created_at: '2026-10-23T12:00:00Z', processed_chunks: 0 }
        : { id: 'transcription-1', job_id: 'job-1', raw_text: 'Maria: Contas aprovadas.', revised_text: null, language: 'pt-BR', is_reviewed: false }
    const select = url.searchParams.get('select')
    const projected = select && select !== '*' ? Object.fromEntries(Object.entries(data).filter(([key]) => select.split(',').includes(key))) : data
    return new Response(JSON.stringify(projected), { status: failure ? 409 : 200, headers: { 'Content-Type': 'application/json' } })
  }))
})
afterEach(() => { vi.unstubAllGlobals() })

describe('transcription import repository', () => {
  it('sends the original content, expected source and optional context to the import action', async () => {
    await ataTranscriptionsRepoSupabase.importText('ata-1', 'zoom.vtt', 'WEBVTT\n\n...', 'old-job', 'Pauta: contas.')
    expect(requests).toEqual([{ path: '/functions/v1/ata-transcriptions', body: { action: 'import', ataId: 'ata-1', fileName: 'zoom.vtt', content: 'WEBVTT\n\n...', expectedJobId: 'old-job', contextText: 'Pauta: contas.' } }])
  })

  it('restores the source identity and imported text after reloading', async () => {
    const loaded = await ataTranscriptionsRepoSupabase.load('ata-1')
    expect(loaded.job).toMatchObject({ sourceType: 'text_import', originalFilename: 'zoom.vtt' })
    expect(loaded.transcription).toMatchObject({ rawText: 'Maria: Contas aprovadas.', isReviewed: false })
  })

  it('surfaces import conflicts as actionable errors', async () => {
    failure = true
    await expect(ataTranscriptionsRepoSupabase.importText('ata-1', 'ata.txt', 'Texto.', null)).rejects.toThrow('A transcrição atual mudou.')
  })
})
