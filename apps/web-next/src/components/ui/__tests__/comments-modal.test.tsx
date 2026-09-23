import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CommentsModal } from '../comments-modal'
import { ticketCommentsRepoSupabase } from '@/repositories/ticketCommentsRepo.supabase'

// A lista é quem busca os comentários; aqui ela só anuncia quantos carregou,
// e cada montagem conta como uma busca.
const listMounts = vi.fn()
let reportCount: (count: number) => void = () => {}
vi.mock('@/components/tickets/TicketCommentsList', () => ({
  TicketCommentsList: ({ onCountChange }: { onCountChange?: (count: number) => void }) => {
    listMounts()
    reportCount = (count) => onCountChange?.(count)
    return <div data-testid="comments-list" />
  },
}))

let addComment: () => Promise<void> = async () => {}
vi.mock('@/components/tickets/TicketCommentInput', () => ({
  TicketCommentInput: ({ onCommentAdded }: { onCommentAdded: () => Promise<void> }) => {
    addComment = onCommentAdded
    return <button type="button" onClick={() => void onCommentAdded()}>Adicionar</button>
  },
}))

vi.mock('@/repositories/ticketCommentsRepo.supabase', () => ({
  ticketCommentsRepoSupabase: { list: vi.fn().mockResolvedValue([]) },
}))
vi.mock('@/repositories/ataCommentsRepo.supabase', () => ({
  ataCommentsRepoSupabase: { list: vi.fn().mockResolvedValue([]) },
}))

describe('CommentsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows and forwards the count the list reports, without fetching comments itself', async () => {
    const onCommentCountChange = vi.fn()
    render(<CommentsModal isOpen onClose={vi.fn()} ticketId="t-1" onCommentCountChange={onCommentCountChange} />)

    act(() => reportCount(3))

    expect(await screen.findByText('3')).toBeInTheDocument()
    expect(onCommentCountChange).toHaveBeenCalledWith(3)
    expect(ticketCommentsRepoSupabase.list).not.toHaveBeenCalled()
  })

  // Antes, adicionar um comentário buscava a lista cinco vezes.
  it('reloads the list once when a comment is added', async () => {
    render(<CommentsModal isOpen onClose={vi.fn()} ticketId="t-1" />)
    const mountsBefore = listMounts.mock.calls.length

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))
      await addComment
    })

    expect(listMounts.mock.calls.length).toBe(mountsBefore + 1)
    expect(ticketCommentsRepoSupabase.list).not.toHaveBeenCalled()
  })
})
