import { act, render, waitFor } from '@testing-library/react'
import { vi, it, expect } from 'vitest'

const mocks = vi.hoisted(() => ({ toast: vi.fn(), init: vi.fn(), cleanup: vi.fn() }))
vi.mock('@/stores/auth.store', () => ({ useAuthStore: (selector: (s: unknown) => unknown) => selector({ userProfile: { id: 'user-1' } }) }))
vi.mock('@/stores/notifications.store', async () => {
  const { create } = await import('zustand')
  return { useNotificationsStore: create(() => ({ init: mocks.init, cleanup: mocks.cleanup, notifications: [], loading: false })) }
})
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }))
vi.mock('@/repositories/tarefasRepo.supabase', () => ({ tarefasRepoSupabase: {} }))
vi.mock('@/hooks/use-toast', () => ({ toast: mocks.toast }))
import { useNotificationsStore } from '@/stores/notifications.store'
import { NotificationsBootstrap } from '../NotificationsBootstrap'

it('shows a toast for a notification received after initial loading', async () => {
  render(<NotificationsBootstrap />)
  act(() => useNotificationsStore.setState({ loading: true }))
  act(() => useNotificationsStore.setState({ loading: false, notifications: [] }))
  act(() => useNotificationsStore.setState({ notifications: [{ id: 'new', type: 'assigned', ticket_id: null, ata_id: null, comment_id: null, ticket_comment_id: null }] as never }))
  await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Ticket atribuído' })))
})
