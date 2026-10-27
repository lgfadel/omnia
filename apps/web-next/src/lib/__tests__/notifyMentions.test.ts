import { expect, it, vi } from 'vitest'
const invoke = vi.hoisted(() => vi.fn())
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke } } }))
import { notifyMentions } from '../notifyMentions'

it('reports a function response error instead of treating it as a successful delivery', async () => {
  invoke.mockResolvedValueOnce({ error: new Error('delivery failed') })
  await expect(notifyMentions({ body: '@[user]', ticket_id: 'ticket' })).rejects.toThrow('delivery failed')
})
