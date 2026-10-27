import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ remove: vi.fn(), from: vi.fn() }))
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mocks.from } }))
import { disablePush } from './subscription'

describe('push subscription lifecycle', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
  it('unsubscribes locally even if removing the server record fails', async () => {
    const storage = new Map<string, string>()
    vi.stubGlobal('localStorage', { setItem: (key: string, value: string) => storage.set(key, value), getItem: (key: string) => storage.get(key) ?? null, removeItem: (key: string) => storage.delete(key) })
    const unsubscribe = vi.fn().mockResolvedValue(true)
    const subscription = { endpoint: 'https://fcm.googleapis.com/example', unsubscribe }
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { getRegistration: vi.fn().mockResolvedValue({ pushManager: { getSubscription: vi.fn().mockResolvedValue(subscription) } }) } })
    mocks.from.mockReturnValue({ delete: () => ({ eq: () => Promise.reject(new Error('offline')) }) })
    localStorage.setItem('omnia-push-owner', 'owner')
    await expect(disablePush()).rejects.toThrow()
    expect(unsubscribe).toHaveBeenCalledOnce()
    expect(localStorage.getItem('omnia-push-owner')).toBeNull()
  })
})
