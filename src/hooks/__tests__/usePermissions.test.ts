import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePermissions, useCanAccess, useCanAccessPath } from '../usePermissions'
import { useUserPermissionsStore } from '@/stores/userPermissions.store'
import type { UserPermission } from '@/repositories/userPermissionsRepo.supabase'

// Mock do store
vi.mock('@/stores/userPermissions.store', () => ({
  useUserPermissionsStore: vi.fn(),
}))

// Mock do AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
  }),
}))

const mockUserPermissions: UserPermission[] = [
  {
    id: '1',
    user_id: 'user-1',
    menu_item_id: 'menu-1',
    can_access: true,
    granted_by: null,
    granted_at: '2025-01-01T00:00:00.000Z',
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
  },
  {
    id: '2',
    user_id: 'user-1',
    menu_item_id: 'menu-2',
    can_access: true,
    granted_by: null,
    granted_at: '2025-01-01T00:00:00.000Z',
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
  },
]

const mockAccessibleMenuItems = [
  {
    id: 'menu-1',
    name: 'Dashboard',
    path: '/dashboard',
    icon: 'Home',
    order_index: 1,
    is_active: true,
    parent_id: null,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
  },
]

const mockStoreState = {
  userPermissions: mockUserPermissions,
  accessibleMenuItems: mockAccessibleMenuItems,
  isLoading: false,
  error: null,
  loadUserPermissions: vi.fn(),
  addUserPermission: vi.fn(),
  updateUserPermission: vi.fn(),
  removeUserPermission: vi.fn(),
  checkUserPermission: vi.fn(),
  loadAccessibleMenuItems: vi.fn(),
}

describe('usePermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useUserPermissionsStore).mockReturnValue(mockStoreState)
  })

  it('should return permissions data and actions', () => {
    const { result } = renderHook(() => usePermissions())

    expect(result.current.userPermissions).toEqual(mockUserPermissions)
    expect(result.current.accessibleMenuItems).toEqual(mockAccessibleMenuItems)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(typeof result.current.loadUserPermissions).toBe('function')
    expect(typeof result.current.checkUserPermission).toBe('function')
  })

  it('should call loadUserPermissions on mount', () => {
    renderHook(() => usePermissions())

    expect(mockStoreState.loadUserPermissions).toHaveBeenCalledOnce()
    expect(mockStoreState.loadAccessibleMenuItems).toHaveBeenCalledOnce()
  })

  it('should handle loading state', () => {
    const loadingState = { ...mockStoreState, isLoading: true }
    vi.mocked(useUserPermissionsStore).mockReturnValue(loadingState)

    const { result } = renderHook(() => usePermissions())

    expect(result.current.isLoading).toBe(true)
  })

  it('should handle error state', () => {
    const errorState = { ...mockStoreState, error: 'Failed to load permissions' }
    vi.mocked(useUserPermissionsStore).mockReturnValue(errorState)

    const { result } = renderHook(() => usePermissions())

    expect(result.current.error).toBe('Failed to load permissions')
  })

  it('should refresh permissions when refreshPermissions is called', async () => {
    const { result } = renderHook(() => usePermissions())

    await act(async () => {
      await result.current.refreshPermissions()
    })

    expect(mockStoreState.loadUserPermissions).toHaveBeenCalledTimes(2) // Once on mount, once on refresh
    expect(mockStoreState.loadAccessibleMenuItems).toHaveBeenCalledTimes(2)
  })
})

describe('useCanAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useUserPermissionsStore).mockReturnValue(mockStoreState)
  })

  it('should return true when user has view permission', () => {
    mockStoreState.checkUserPermission.mockReturnValue({
      canView: true,
      canEdit: false,
      canDelete: false,
    })

    const { result } = renderHook(() => useCanAccess('menu-1'))

    expect(result.current.canView).toBe(true)
    expect(result.current.canEdit).toBe(false)
    expect(result.current.canDelete).toBe(false)
    expect(mockStoreState.checkUserPermission).toHaveBeenCalledWith('menu-1')
  })

  it('should return false when user has no permissions', () => {
    mockStoreState.checkUserPermission.mockReturnValue({
      canView: false,
      canEdit: false,
      canDelete: false,
    })

    const { result } = renderHook(() => useCanAccess('menu-3'))

    expect(result.current.canView).toBe(false)
    expect(result.current.canEdit).toBe(false)
    expect(result.current.canDelete).toBe(false)
  })

  it('should update when menuItemId changes', () => {
    const { result, rerender } = renderHook(
      ({ menuItemId }) => useCanAccess(menuItemId),
      { initialProps: { menuItemId: 'menu-1' } }
    )

    expect(mockStoreState.checkUserPermission).toHaveBeenCalledWith('menu-1')

    rerender({ menuItemId: 'menu-2' })

    expect(mockStoreState.checkUserPermission).toHaveBeenCalledWith('menu-2')
  })
})

describe('useCanAccessPath', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useUserPermissionsStore).mockReturnValue(mockStoreState)
  })

  it('should return true when user can access path', () => {
    const { result } = renderHook(() => useCanAccessPath('/dashboard'))

    expect(result.current).toBe(true)
  })

  it('should return false when user cannot access path', () => {
    const { result } = renderHook(() => useCanAccessPath('/admin'))

    expect(result.current).toBe(false)
  })

  it('should handle paths with parameters', () => {
    const { result } = renderHook(() => useCanAccessPath('/dashboard/123'))

    expect(result.current).toBe(true)
  })

  it('should update when path changes', () => {
    const { result, rerender } = renderHook(
      ({ path }) => useCanAccessPath(path),
      { initialProps: { path: '/dashboard' } }
    )

    expect(result.current).toBe(true)

    rerender({ path: '/admin' })

    expect(result.current).toBe(false)
  })
})