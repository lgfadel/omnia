import { describe, expect, it } from 'vitest'
import { notificationPath } from './navigation'

describe('notificationPath', () => {
  it('opens the referenced task or meeting', () => {
    expect(notificationPath({ ticket_id: 'abc', ata_id: null })).toBe('/tarefas/abc')
    expect(notificationPath({ ticket_id: null, ata_id: 'def' })).toBe('/atas/def')
  })
  it('falls back safely when no destination exists', () => {
    expect(notificationPath({ ticket_id: null, ata_id: null })).toBe('/')
    expect(notificationPath({ ticket_id: '../x', ata_id: null })).toBe('/')
  })
})
