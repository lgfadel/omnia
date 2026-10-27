import { describe, expect, it } from 'vitest'
import { isIosDevice, permissionState } from './subscription'

describe('push availability', () => {
  it('recognizes iPhone and iPad browsers', () => {
    expect(isIosDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)')).toBe(true)
    expect(isIosDevice('Mozilla/5.0 (Linux; Android 14)')).toBe(false)
  })
  it('requires installation on iOS before requesting permission', () => {
    expect(permissionState({ supported: true, ios: true, standalone: false, permission: 'default' })).toBe('install')
    expect(permissionState({ supported: true, ios: true, standalone: true, permission: 'denied' })).toBe('denied')
    expect(permissionState({ supported: false, ios: false, standalone: false, permission: 'default' })).toBe('unsupported')
    expect(permissionState({ supported: true, ios: false, standalone: false, permission: 'default' })).toBe('ready')
  })
})
