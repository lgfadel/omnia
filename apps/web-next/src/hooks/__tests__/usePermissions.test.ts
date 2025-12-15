import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePermissions, useCanAccess, useCanAccessPath } from '../usePermissions'

// Mock the userPermissions store
const mockStoreState = {
  currentUserPermissions: [],
  accessibleMenuItems: [],
  isLoading: false,
  error: null,
  loadCurrentUserPermissions: vi.fn().mockResolvedValue(undefined),
  loadUserAccessibleMenuItems: vi.fn().mockResolvedValue(undefined),
  checkCurrentUserMenuPermission: vi.fn(() => Promise.resolve(true)),
  checkCurrentUserMenuPermissionByPath: vi.fn(() => Promise.resolve(true)),
  clearError: vi.fn(),
}

vi.mock('@/stores/userPermissions.store', () => ({
  useUserPermissionsStore: () => ({
    ...mockStoreState,
  })
}))

// Mock AuthProvider
const mockAuthState = {
  user: {
    id: 'user-1',
    email: 'test@example.com',
  },
}

vi.mock('@/components/auth/AuthProvider', () => ({
  useAuth: () => mockAuthState,
}))

describe('usePermissions', () => {
  it('should return permission data and functions', () => {
    const { result } = renderHook(() => usePermissions())
    
    expect(result.current).toHaveProperty('canAccess')
    expect(result.current).toHaveProperty('canAccessPath')
    expect(result.current).toHaveProperty('hasPermission')
    expect(result.current).toHaveProperty('hasPermissionForPath')
    expect(result.current).toHaveProperty('accessibleMenuItems')
    expect(result.current).toHaveProperty('isLoading')
    expect(result.current).toHaveProperty('error')
    expect(result.current).toHaveProperty('refresh')
  })

  it('should have correct initial state', () => {
    const { result } = renderHook(() => usePermissions())
    
    expect(typeof result.current.canAccess).toBe('function')
    expect(typeof result.current.canAccessPath).toBe('function')
    expect(typeof result.current.hasPermission).toBe('function')
    expect(typeof result.current.hasPermissionForPath).toBe('function')
    expect(Array.isArray(result.current.accessibleMenuItems)).toBe(true)
    expect(typeof result.current.isLoading).toBe('boolean')
    expect(typeof result.current.refresh).toBe('function')
  })
})

describe('useCanAccess', () => {
  it('should return access data', () => {
    const { result } = renderHook(() => useCanAccess('menu-1'))
    
    expect(result.current).toHaveProperty('canAccess')
    expect(result.current).toHaveProperty('isLoading')
    expect(result.current).toHaveProperty('error')
  })
})

describe('useCanAccessPath', () => {
  it('should return path access data', () => {
    const { result } = renderHook(() => useCanAccessPath('/test'))
    
    expect(result.current).toHaveProperty('canAccess')
    expect(result.current).toHaveProperty('isLoading')
    expect(result.current).toHaveProperty('error')
  })
})