import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TicketCommentsList } from '../TicketCommentsList'
import { ticketCommentsRepoSupabase } from '@/repositories/ticketCommentsRepo.supabase'

vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ userProfile: null }) }))
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }))
vi.mock('@/repositories/ticketCommentsRepo.supabase', () => ({
  ticketCommentsRepoSupabase: {
    list: vi.fn().mockResolvedValue([
      { id: 'c1', body: 'primeiro', author_id: 'u1', created_at: '2026-09-01T10:00:00Z' },
      { id: 'c2', body: 'segundo', author_id: 'u1', created_at: '2026-09-01T11:00:00Z' },
    ]),
  },
}))
vi.mock('@/repositories/ataCommentsRepo.supabase', () => ({ ataCommentsRepoSupabase: { list: vi.fn() } }))
vi.mock('@/repositories/ticketAttachmentsRepo.supabase', () => ({
  ticketAttachmentsRepoSupabase: { list: vi.fn().mockResolvedValue([]) },
}))
vi.mock('@/repositories/secretariosRepo.supabase', () => ({
  secretariosRepoSupabase: { list: vi.fn().mockResolvedValue([]) },
}))

describe('TicketCommentsList · contagem', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reports how many comments it loaded', async () => {
    const onCountChange = vi.fn()
    render(<TicketCommentsList ticketId="t-1" onCountChange={onCountChange} />)

    await waitFor(() => expect(onCountChange).toHaveBeenCalledWith(2))
  })

  // O modal repassa a contagem a um pai que a entrega como arrow inline — uma
  // função nova a cada render. Se isso recarregasse a lista, cada carga faria o
  // pai renderizar e disparar outra carga, sem fim.
  it('does not reload when only the count callback changes', async () => {
    const { rerender } = render(<TicketCommentsList ticketId="t-1" onCountChange={vi.fn()} />)
    await waitFor(() => expect(ticketCommentsRepoSupabase.list).toHaveBeenCalledTimes(1))

    const latest = vi.fn()
    rerender(<TicketCommentsList ticketId="t-1" onCountChange={latest} />)
    rerender(<TicketCommentsList ticketId="t-1" onCountChange={vi.fn()} />)

    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(ticketCommentsRepoSupabase.list).toHaveBeenCalledTimes(1)
  })
})
