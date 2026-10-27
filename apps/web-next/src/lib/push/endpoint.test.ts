import { describe, expect, it } from 'vitest'
import { isAllowedPushEndpoint } from '../../../../../supabase/functions/send-web-push/endpoint'

describe('push endpoint validation', () => {
  it('accepts known HTTPS push services', () => {
    expect(isAllowedPushEndpoint('https://fcm.googleapis.com/fcm/send/token')).toBe(true)
    expect(isAllowedPushEndpoint('https://web.push.apple.com/Q/token')).toBe(true)
    expect(isAllowedPushEndpoint('https://updates.push.services.mozilla.com/wpush/token')).toBe(true)
  })
  it('rejects internal, forged, and non-HTTPS destinations', () => {
    for (const url of ['http://fcm.googleapis.com/x', 'https://fcm.googleapis.com.evil.test/x', 'https://127.0.0.1/x', 'not a url', 'https://evil.test/x']) {
      expect(isAllowedPushEndpoint(url)).toBe(false)
    }
  })
})
