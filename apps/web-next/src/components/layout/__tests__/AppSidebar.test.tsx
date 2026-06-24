import { fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SidebarProvider } from '@/components/ui/sidebar'
import type { MenuItem } from '@/repositories/menuItemsRepo.supabase'
import { AppSidebar } from '../AppSidebar'

vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}))

vi.mock('@/components/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { email: 'user@example.com' },
    userProfile: { name: 'Usuário' },
    signOut: vi.fn(),
  }),
}))

vi.mock('@/hooks/useRoles', () => ({
  useRoles: () => ({
    canAccessConfig: () => true,
  }),
}))

const menuItem = (
  overrides: Partial<MenuItem> & Pick<MenuItem, 'id' | 'name' | 'path' | 'order_index'>
): MenuItem => ({
  icon: 'Settings',
  parent_id: null,
  is_active: true,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

const configChildren = [
  menuItem({ id: 'users', name: 'Usuários', path: '/config/usuarios', order_index: 1, parent_id: 'config', icon: 'Users' }),
  menuItem({ id: 'admins', name: 'Administradoras', path: '/config/administradoras', order_index: 2, parent_id: 'config', icon: 'Building2' }),
  menuItem({ id: 'tags', name: 'Tags', path: '/config/tags', order_index: 3, parent_id: 'config', icon: 'Tags' }),
  menuItem({ id: 'condos', name: 'Condomínios', path: '/config/condominiums', order_index: 4, parent_id: 'config', icon: 'Building2' }),
]

vi.mock('@/hooks/useMenuItems', () => ({
  useAccessibleMenuTree: () => ({
    menuTree: [
      menuItem({ id: 'dashboard', name: 'Dashboard', path: '/', order_index: 1, icon: 'Home' }),
      {
        ...menuItem({ id: 'config', name: 'Configurações', path: '/config', order_index: 2 }),
        children: configChildren,
      },
    ],
    isLoading: false,
    error: null,
  }),
}))

describe('AppSidebar', () => {
  it('orders the Configurações submenu alphabetically', () => {
    const { container } = render(
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: /Configurações/i }))

    const configItemLabels = Array.from(container.querySelectorAll('a[href^="/config/"]'))
      .map((link) => link.textContent?.trim())

    expect(configItemLabels).toEqual([
      'Administradoras',
      'Condomínios',
      'Tags',
      'Usuários',
    ])
  })
})
