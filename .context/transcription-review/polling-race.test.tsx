import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { AtaTranscriptionPanel } from '@/components/atas/AtaTranscriptionPanel'
import { ataTranscriptionsRepoSupabase } from '@/repositories/ataTranscriptionsRepo.supabase'

vi.mock('@/repositories/ataTranscriptionsRepo.supabase', () => ({
  ataTranscriptionsRepoSupabase: {
    load: vi.fn(), upload: vi.fn(), retry: vi.fn(), saveReview: vi.fn(), discard: vi.fn(),
    audioUrl: vi.fn().mockResolvedValue(null),
    wake: vi.fn().mockResolvedValue({ workerAvailable: true, stalled: false }),
  },
}))

afterEach(() => vi.useRealTimers())

it('preserves an edit when an earlier processing poll returns after completion', async () => {
  vi.useFakeTimers()
  const repo = vi.mocked(ataTranscriptionsRepoSupabase)
  const completed = {
    job: { id: 'job-1', ataId: 'ata-1', status: 'completed' as const, originalFilename: 'audio.m4a', attemptCount: 1, createdAt: new Date().toISOString(), processedChunks: 1 },
    transcription: { id: 'transcription-1', jobId: 'job-1', rawText: 'Original text', language: 'pt', isReviewed: false },
  }
  const processing = { job: { ...completed.job, status: 'processing' as const, heartbeatAt: new Date().toISOString() }, transcription: null }
  let finishEarlier!: (value: typeof processing) => void
  const earlier = new Promise<typeof processing>((resolve) => { finishEarlier = resolve })
  repo.load.mockResolvedValueOnce(processing).mockReturnValueOnce(earlier).mockResolvedValueOnce(completed)
  render(<AtaTranscriptionPanel ataId="ata-1" />)
  await act(async () => { await Promise.resolve() })
  await act(async () => { await vi.advanceTimersByTimeAsync(7_500) })
  await act(async () => { await vi.advanceTimersByTimeAsync(7_500) })
  const editor = screen.getByLabelText('Texto da transcrição')
  fireEvent.change(editor, { target: { value: 'Corrected name and votes' } })
  await act(async () => { finishEarlier(processing); await Promise.resolve() })
  expect(screen.queryByLabelText('Texto da transcrição')).toHaveValue('Corrected name and votes')
})
