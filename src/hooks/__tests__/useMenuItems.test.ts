import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useMenuItems } from '../useMenuItems';
import { useMenuItemsStore } from '../../stores/menuItems.store';
import { usePermissions } from '../usePermissions';

// Mock the stores and hooks
vi.mock('../../stores/menuItems.store');
vi.mock('../usePermissions');

const mockUseMenuItemsStore = vi.mocked(useMenuItemsStore);
const mockUsePermissions = vi.mocked(usePermissions);

describe('useMenuItems', () => {
  const mockMenuItems = [
    {
      id: 'menu-1',
      name: 'Dashboard',
      path: '/dashboard',
      icon: 'Home',
      parent_id: null,
      order_index: 1,
      is_active: true,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z'
    },
    {
      id: 'menu-2',
      name: 'Configurações',
      path: '/config',
      icon: 'Settings',
      parent_id: null,
      order_index: 2,
      is_active: true,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z'
    }
  ];

  const mockAccessibleMenuItems = [mockMenuItems[0]]; // Only dashboard accessible

  const mockMenuStore = {
    menuItems: mockMenuItems,
    rootItems: mockMenuItems,
    isLoading: false,
    error: null,
    loadMenuItems: vi.fn(),
    loadRootItems: vi.fn(),
    loadChildren: vi.fn(),
    getById: vi.fn(),
    getByPath: vi.fn(),
    clearError: vi.fn()
  };

  const mockPermissions = {
    accessibleMenuItems: mockAccessibleMenuItems,
    hasPermission: vi.fn(),
    isLoading: false,
    error: null
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMenuItemsStore.mockReturnValue(mockMenuStore);
    mockUsePermissions.mockReturnValue({
      ...mockPermissions,
      canAccess: vi.fn().mockReturnValue(true),
      canAccessPath: vi.fn().mockReturnValue(true),
      hasPermissionForPath: vi.fn().mockReturnValue(true),
      refresh: vi.fn()
    });
    mockPermissions.hasPermission.mockReturnValue(true);
  });

  it('should return menu items data', () => {
    const { result } = renderHook(() => useMenuItems());

    expect(result.current.allMenuItems).toEqual(mockMenuItems);
    expect(result.current.rootMenuItems).toEqual(mockMenuItems);
    expect(result.current.accessibleMenuItems).toEqual(mockAccessibleMenuItems);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('should return loading state from menu store', () => {
    mockUseMenuItemsStore.mockReturnValue({
      ...mockMenuStore,
      isLoading: true
    });

    const { result } = renderHook(() => useMenuItems());

    expect(result.current.isLoading).toBe(true);
  });

  it('should return loading state from permissions', () => {
    mockUsePermissions.mockReturnValue({
      ...mockPermissions,
      isLoading: true,
      canAccess: vi.fn().mockReturnValue(true),
      canAccessPath: vi.fn().mockReturnValue(true),
      hasPermissionForPath: vi.fn().mockReturnValue(true),
      refresh: vi.fn()
    });

    const { result } = renderHook(() => useMenuItems());

    expect(result.current.isLoading).toBe(true);
  });

  it('should return error state from menu store', () => {
    const mockError = 'Failed to load menu items';
    mockUseMenuItemsStore.mockReturnValue({
      ...mockMenuStore,
      error: mockError
    });

    const { result } = renderHook(() => useMenuItems());

    expect(result.current.error).toBe(mockError);
  });

  it('should return error state from permissions', () => {
    const mockError = 'Failed to load permissions';
    mockUsePermissions.mockReturnValue({
      ...mockPermissions,
      error: mockError,
      canAccess: vi.fn().mockReturnValue(true),
      canAccessPath: vi.fn().mockReturnValue(true),
      hasPermissionForPath: vi.fn().mockReturnValue(true),
      refresh: vi.fn()
    });

    const { result } = renderHook(() => useMenuItems());

    expect(result.current.error).toBe(mockError);
  });

  it('should load menu items and root items on mount', async () => {
    renderHook(() => useMenuItems());

    await waitFor(() => {
      expect(mockMenuStore.loadMenuItems).toHaveBeenCalled();
      expect(mockMenuStore.loadRootItems).toHaveBeenCalled();
    });
  });

  it('should provide utility functions', () => {
    const { result } = renderHook(() => useMenuItems());

    expect(typeof result.current.getChildren).toBe('function');
    expect(typeof result.current.getAccessibleChildren).toBe('function');
    expect(typeof result.current.getMenuItemById).toBe('function');
    expect(typeof result.current.getMenuItemByPath).toBe('function');
    expect(typeof result.current.buildMenuTree).toBe('function');
    expect(typeof result.current.buildAccessibleMenuTree).toBe('function');
    expect(typeof result.current.refresh).toBe('function');
  });

  it('should call refresh and reload data', async () => {
    const { result } = renderHook(() => useMenuItems());

    await result.current.refresh();

    expect(mockMenuStore.clearError).toHaveBeenCalled();
    expect(mockMenuStore.loadMenuItems).toHaveBeenCalled();
    expect(mockMenuStore.loadRootItems).toHaveBeenCalled();
  });

  it('should call getChildren from store', async () => {
    const { result } = renderHook(() => useMenuItems());
    const mockChildren = [mockMenuItems[1]];
    mockMenuStore.loadChildren.mockResolvedValue(mockChildren);

    const children = await result.current.getChildren('menu-1');

    expect(mockMenuStore.loadChildren).toHaveBeenCalledWith('menu-1');
    expect(children).toEqual(mockChildren);
  });

  it('should filter accessible children', async () => {
    const { result } = renderHook(() => useMenuItems());
    const mockChildren = [mockMenuItems[1]];
    mockMenuStore.loadChildren.mockResolvedValue(mockChildren);
    mockPermissions.hasPermission.mockReturnValue(true);

    const accessibleChildren = await result.current.getAccessibleChildren('menu-1');

    expect(mockMenuStore.loadChildren).toHaveBeenCalledWith('menu-1');
    expect(mockPermissions.hasPermission).toHaveBeenCalledWith('menu-2');
    expect(accessibleChildren).toEqual(mockChildren);
  });

  it('should delegate getMenuItemById to store', () => {
    const { result } = renderHook(() => useMenuItems());
    mockMenuStore.getById.mockReturnValue(mockMenuItems[0]);

    const menuItem = result.current.getMenuItemById('menu-1');

    expect(mockMenuStore.getById).toHaveBeenCalledWith('menu-1');
    expect(menuItem).toEqual(mockMenuItems[0]);
  });

  it('should delegate getMenuItemByPath to store', () => {
    const { result } = renderHook(() => useMenuItems());
    mockMenuStore.getByPath.mockReturnValue(mockMenuItems[0]);

    const menuItem = result.current.getMenuItemByPath('/dashboard');

    expect(mockMenuStore.getByPath).toHaveBeenCalledWith('/dashboard');
    expect(menuItem).toEqual(mockMenuItems[0]);
  });
});