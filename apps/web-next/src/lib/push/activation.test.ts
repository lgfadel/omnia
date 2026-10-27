import { afterEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), upsert: vi.fn(), from: vi.fn() }))
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getUser: mocks.getUser }, from: mocks.from } }))
import { enablePush } from './subscription'

describe('first push activation', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks() })
  it('waits for worker activation before subscribing and saving the installation', async () => {
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'AQID')
    const storage = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) })
    vi.stubGlobal('PushManager', class {})
    vi.stubGlobal('Notification', { permission: 'granted', requestPermission: vi.fn().mockResolvedValue('granted') })
    let activate!: () => void
    let active = false
    const ready = new Promise<unknown>(resolve => { activate = () => { active = true; resolve(registration) } })
    const subscription = { endpoint: 'https://web.push.apple.com/example', toJSON: () => ({ keys: { p256dh: 'key', auth: 'auth' } }), unsubscribe: vi.fn() }
    const subscribe = vi.fn(async () => { if (!active) throw new DOMException('No active Service Worker', 'InvalidStateError'); return subscription })
    const registration = { pushManager: { getSubscription: vi.fn().mockResolvedValue(null), subscribe } }
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { register: vi.fn().mockResolvedValue(registration), ready } })
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'auth-id' } }, error: null })
    mocks.upsert.mockResolvedValue({ error: null })
    mocks.from.mockReturnValue({ upsert: mocks.upsert })
    const enabled = enablePush('profile-id')
    void enabled.catch(() => {})
    // Let the initial registration finish while its worker is still installing.
    await new Promise(resolve => setTimeout(resolve, 0))
    activate()
    await enabled
    expect(storage.get('omnia-push-owner')).toBe('auth-id')
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'profile-id', endpoint: subscription.endpoint }), { onConflict: 'endpoint' })
  })
})
