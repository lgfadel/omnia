import { describe, expect, it } from 'vitest'
import { isApiRoute } from '../routeAccess'

describe('isApiRoute', () => {
  it('identifies API routes so cookie-only redirects do not block bearer authentication', () => {
    expect(isApiRoute('/api/malotes/settings')).toBe(true)
    expect(isApiRoute('/api/balancetes/protocol-imports')).toBe(true)
  })

  it('does not classify application pages as API routes', () => {
    expect(isApiRoute('/malotes')).toBe(false)
    expect(isApiRoute('/auth')).toBe(false)
  })
})
