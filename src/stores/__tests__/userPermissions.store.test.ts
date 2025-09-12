import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useUserPermissionsStore } from '../userPermissions.store';
import { userPermissionsRepoSupabase } from '../../repositories/userPermissionsRepo.supabase';
import type { UserPermission, CreateUserPermissionData, UpdateUserPermissionData } from '../../repositories/userPermissionsRepo.supabase';

// Mock the repository
vi.mock('../../repositories/userPermissionsRepo.supabase');

const mockRepo = vi.mocked(userPermissionsRepoSupabase);

describe('useUserPermissionsStore', () => {
  const mockUserPermissions: UserPermission[] = [
    {
      id: 'perm-1',
      user_id: 'user-1',
      menu_item_id: 'menu-1',
      can_access: true,
      granted_by: 'admin-1',
      granted_at: '2025-01-01T00:00:00Z',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z'
    },
    {
      id: 'perm-2',
      user_id: 'user-1',
      menu_item_id: 'menu-2',
      can_access: false,
      granted_by: 'admin-1',
      granted_at: '2025-01-01T00:00:00Z',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state
    const store = useUserPermissionsStore.getState();
    store.userPermissions = [];
    store.isLoading = false;
    store.error = null;
  });

  it('should have initial state', () => {
    const store = useUserPermissionsStore.getState();
    
    expect(store.userPermissions).toEqual([]);
    expect(store.isLoading).toBe(false);
    expect(store.error).toBe(null);
  });

  it('should load user permissions successfully', async () => {
    mockRepo.getByUserId.mockResolvedValue(mockUserPermissions);
    
    const store = useUserPermissionsStore.getState();
    await store.loadUserPermissions('user-1');
    
    const updatedStore = useUserPermissionsStore.getState();
    expect(mockRepo.getByUserId).toHaveBeenCalledWith('user-1');
    expect(updatedStore.userPermissions).toEqual(mockUserPermissions);
    expect(updatedStore.isLoading).toBe(false);
    expect(updatedStore.error).toBe(null);
  });

  it('should handle load user permissions error', async () => {
    const errorMessage = 'Failed to load permissions';
    mockRepo.getByUserId.mockRejectedValue(new Error(errorMessage));
    
    const store = useUserPermissionsStore.getState();
    await store.loadUserPermissions('user-1');
    
    const updatedStore = useUserPermissionsStore.getState();
    expect(updatedStore.userPermissions).toEqual([]);
    expect(updatedStore.isLoading).toBe(false);
    expect(updatedStore.error).toBe(errorMessage);
  });

  it('should set loading state during load operation', async () => {
    let resolvePromise: (value: UserPermission[]) => void;
    const promise = new Promise<UserPermission[]>((resolve) => {
      resolvePromise = resolve;
    });
    mockRepo.getByUserId.mockReturnValue(promise);
    
    const store = useUserPermissionsStore.getState();
    const loadPromise = store.loadUserPermissions('user-1');
    
    // Check loading state
    const loadingStore = useUserPermissionsStore.getState();
    expect(loadingStore.isLoading).toBe(true);
    
    // Resolve the promise
    resolvePromise!(mockUserPermissions);
    await loadPromise;
    
    // Check final state
    const finalStore = useUserPermissionsStore.getState();
    expect(finalStore.isLoading).toBe(false);
  });

  it('should add user permission successfully', async () => {
    const newPermission: UserPermission = {
      id: 'perm-3',
      user_id: 'user-2',
      menu_item_id: 'menu-3',
      can_access: true,
      granted_by: 'admin-1',
      granted_at: '2025-01-01T00:00:00Z',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z'
    };
    
    const createData: CreateUserPermissionData = {
      user_id: 'user-2',
      menu_item_id: 'menu-3',
      can_access: true,
      granted_by: 'admin-1'
    };
    
    mockRepo.create.mockResolvedValue(newPermission);
    
    // Set initial state
    const store = useUserPermissionsStore.getState();
    store.userPermissions = mockUserPermissions;
    
    await store.addUserPermission(createData);
    
    const updatedStore = useUserPermissionsStore.getState();
    expect(mockRepo.create).toHaveBeenCalledWith(createData);
    expect(updatedStore.userPermissions).toContain(newPermission);
    expect(updatedStore.userPermissions).toHaveLength(3);
  });

  it('should handle add user permission error', async () => {
    const errorMessage = 'Failed to create permission';
    const createData: CreateUserPermissionData = {
      user_id: 'user-2',
      menu_item_id: 'menu-3',
      can_access: true,
      granted_by: 'admin-1'
    };
    
    mockRepo.create.mockRejectedValue(new Error(errorMessage));
    
    const store = useUserPermissionsStore.getState();
    await store.addUserPermission(createData);
    
    const updatedStore = useUserPermissionsStore.getState();
    expect(updatedStore.error).toBe(errorMessage);
  });

  it('should update user permission successfully', async () => {
    const updatedPermission: UserPermission = {
      ...mockUserPermissions[0],
      can_access: false
    };
    
    const updateData: UpdateUserPermissionData = {
      can_access: false
    };
    
    mockRepo.update.mockResolvedValue(updatedPermission);
    
    // Set initial state
    const store = useUserPermissionsStore.getState();
    store.userPermissions = [...mockUserPermissions];
    
    await store.updateUserPermission('perm-1', updateData);
    
    const updatedStore = useUserPermissionsStore.getState();
    expect(mockRepo.update).toHaveBeenCalledWith('perm-1', updateData);
    expect(updatedStore.userPermissions[0]).toEqual(updatedPermission);
  });

  it('should handle update user permission error', async () => {
    const errorMessage = 'Failed to update permission';
    const updateData: UpdateUserPermissionData = {
      can_access: false
    };
    
    mockRepo.update.mockRejectedValue(new Error(errorMessage));
    
    const store = useUserPermissionsStore.getState();
    await store.updateUserPermission('perm-1', updateData);
    
    const updatedStore = useUserPermissionsStore.getState();
    expect(updatedStore.error).toBe(errorMessage);
  });

  it('should remove user permission successfully', async () => {
    mockRepo.remove.mockResolvedValue(true);
    
    // Set initial state
    const store = useUserPermissionsStore.getState();
    store.userPermissions = [...mockUserPermissions];
    
    await store.removeUserPermission('perm-1');
    
    const updatedStore = useUserPermissionsStore.getState();
    expect(mockRepo.remove).toHaveBeenCalledWith('perm-1');
    expect(updatedStore.userPermissions).toHaveLength(1);
    expect(updatedStore.userPermissions.find(p => p.id === 'perm-1')).toBeUndefined();
  });

  it('should handle remove user permission error', async () => {
    const errorMessage = 'Failed to delete permission';
    mockRepo.remove.mockRejectedValue(new Error(errorMessage));
    
    const store = useUserPermissionsStore.getState();
    await store.removeUserPermission('perm-1');
    
    const updatedStore = useUserPermissionsStore.getState();
    expect(updatedStore.error).toBe(errorMessage);
  });

  it('should clear error', () => {
    // Set error state
    const store = useUserPermissionsStore.getState();
    store.error = 'Some error';
    
    store.clearError();
    
    const updatedStore = useUserPermissionsStore.getState();
    expect(updatedStore.error).toBe(null);
  });

  it('should check user menu permission', async () => {
    mockRepo.checkUserMenuPermission.mockResolvedValue(true);
    
    const store = useUserPermissionsStore.getState();
    const hasPermission = await store.checkUserMenuPermission('user-1', '/menu-path');
    
    expect(mockRepo.checkUserMenuPermission).toHaveBeenCalledWith('user-1', '/menu-path');
    expect(hasPermission).toBe(true);
  });

  it('should remove user permission by user and menu item', async () => {
    mockRepo.removeByUserAndMenuItem.mockResolvedValue(true);
    
    const store = useUserPermissionsStore.getState();
    await store.removeUserPermissionByUserAndMenuItem('user-1', 'menu-1');
    
    expect(mockRepo.removeByUserAndMenuItem).toHaveBeenCalledWith('user-1', 'menu-1');
  });

  it('should get user permissions summary', async () => {
    const mockSummary = [
      {
        menu_item_id: 'menu-1',
        menu_item_name: 'Menu 1',
        menu_item_path: '/menu-1',
        permission_source: 'direct',
        can_access: true,
        granted_by_name: 'Admin',
        granted_at: '2025-01-01T00:00:00Z'
      }
    ];
    
    mockRepo.getUserPermissionsSummary.mockResolvedValue(mockSummary);
    
    const store = useUserPermissionsStore.getState();
    await store.loadUserPermissionsSummary('user-1');
    
    expect(mockRepo.getUserPermissionsSummary).toHaveBeenCalledWith('user-1');
     const updatedStore = useUserPermissionsStore.getState();
     expect(updatedStore.permissionsSummary).toEqual(mockSummary);
  });

  it('should clear user permissions', () => {
    // Set initial state
    const store = useUserPermissionsStore.getState();
    store.userPermissions = mockUserPermissions;
    
    store.clearUserPermissions();
    
    const updatedStore = useUserPermissionsStore.getState();
    expect(updatedStore.userPermissions).toEqual([]);
    expect(updatedStore.currentUserPermissions).toEqual([]);
    expect(updatedStore.accessibleMenuItems).toEqual([]);
    expect(updatedStore.permissionsSummary).toBe(null);
  });
});