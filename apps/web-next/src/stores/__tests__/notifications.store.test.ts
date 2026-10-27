import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ list: vi.fn(), callbacks: {} as Record<string, (payload: any) => void>, status: null as null | ((status: string) => void), unsubscribe: vi.fn() }))
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  auth: { getSession: async () => ({ data: { session: null } }) }, realtime: { setAuth: vi.fn() },
  channel: () => ({ on(_kind: string, filter: {event: string}, cb: (payload: any) => void) { mocks.callbacks[filter.event] = cb; return this }, subscribe(cb: (status: string) => void) { mocks.status = cb; return this }, unsubscribe: mocks.unsubscribe })
} }))
vi.mock('@/lib/logging', () => ({ logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('@/repositories/notificationsRepo.supabase', () => ({ notificationsRepoSupabase: { listRecent: mocks.list } }))
import { useNotificationsStore } from '../notifications.store'

beforeEach(() => { useNotificationsStore.getState().cleanup(); mocks.list.mockReset(); mocks.callbacks = {}; mocks.status = null })
it('keeps notifications arriving while the initial list is being fetched', async () => {
  let resolve!: (value: any[]) => void
  mocks.list.mockReturnValue(new Promise(r => { resolve = r }))
  const init = useNotificationsStore.getState().init('user-1')
  await Promise.resolve(); await Promise.resolve()
  expect(mocks.status).not.toBeNull()
  mocks.status!('SUBSCRIBED')
  mocks.callbacks.INSERT({ new: { id: 'new', user_id: 'user-1', read_at: null } })
  resolve([])
  await init
  expect(useNotificationsStore.getState().notifications.map(n => n.id)).toContain('new')
})
