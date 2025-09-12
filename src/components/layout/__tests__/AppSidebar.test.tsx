import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AppSidebar } from '../AppSidebar'
import { useAuth } from '@/contexts/AuthContext'
import { useRoles } from '@/hooks/useRoles'
import { useAccessibleMenuTree } from '@/hooks/useMenuItems'
import { useSidebar } from '@/components/ui/sidebar'

// Mock dos hooks
vi.mock('@/contexts/AuthContext')
vi.mock('@/hooks/useRoles')
vi.mock('@/hooks/useMenuItems')
vi.mock('@/components/ui/sidebar')

// Mock do react-router-dom
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    NavLink: ({ children, to, className, ...props }: any) => (
      <a href={to} className={typeof className === 'function' ? className({ isActive: false }) : className} {...props}>
        {children}
      </a>
    ),
  }
})

const mockUseAuth = useAuth as vi.MockedFunction<typeof useAuth>
const mockUseRoles = useRoles as vi.MockedFunction<typeof useRoles>
const mockUseAccessibleMenuTree = useAccessibleMenuTree as vi.MockedFunction<typeof useAccessibleMenuTree>
const mockUseSidebar = useSidebar as vi.MockedFunction<typeof useSidebar>

const mockUser = {
  id: '1',
  email: 'test@example.com',
  aud: 'authenticated',
  role: 'authenticated',
  email_confirmed_at: '2023-01-01T00:00:00Z',
  phone: null,
  confirmed_at: '2023-01-01T00:00:00Z',
  last_sign_in_at: '2023-01-01T00:00:00Z',
  app_metadata: {},
  user_metadata: {},
  identities: [],
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z'
}

const mockUserProfile = {
  id: '1',
  name: 'Test User',
  email: 'test@example.com',
  auth_user_id: '1',
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z'
}

const mockMenuItems = [
  {
    id: '1',
    name: 'Dashboard',
    path: '/dashboard',
    icon: 'home',
    parent_id: null,
    order_index: 1,
    is_active: true,
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
    children: []
  },
  {
    id: '2',
    name: 'Configurações',
    path: '/config',
    icon: 'settings',
    parent_id: null,
    order_index: 2,
    is_active: true,
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
    children: []
  }
]

const renderAppSidebar = () => {
  return render(
    <BrowserRouter>
      <AppSidebar />
    </BrowserRouter>
  )
}

describe('AppSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    mockUseAuth.mockReturnValue({
      user: mockUser,
      userProfile: mockUserProfile,
      signOut: vi.fn(),
      signIn: vi.fn(),
      signUp: vi.fn(),
      resetPassword: vi.fn(),
      session: null,
      loading: false
    })
    
    mockUseRoles.mockReturnValue({
      canAccessConfig: vi.fn().mockReturnValue(true),
      hasRole: vi.fn(),
      userRoles: [],
      isLoading: false
    })
    
    mockUseAccessibleMenuTree.mockReturnValue({
      menuTree: mockMenuItems,
      isLoading: false,
      error: null
    })
    
    mockUseSidebar.mockReturnValue({
      state: 'expanded',
      open: true,
      setOpen: vi.fn(),
      openMobile: false,
      setOpenMobile: vi.fn(),
      isMobile: false,
      toggleSidebar: vi.fn()
    })
  })

  it('deve renderizar o sidebar com logo', () => {
    renderAppSidebar()
    
    const logo = screen.getByAltText('Omnia Logo')
    expect(logo).toBeInTheDocument()
  })

  it('deve renderizar informações do usuário', () => {
    renderAppSidebar()
    
    expect(screen.getByText('Test User')).toBeInTheDocument()
    expect(screen.getByText('test@example.com')).toBeInTheDocument()
  })

  it('deve renderizar itens de menu principal', () => {
    renderAppSidebar()
    
    expect(screen.getByText('Principal')).toBeInTheDocument()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('deve renderizar itens de configuração', () => {
    renderAppSidebar()
    
    expect(screen.getByText('Configurações')).toBeInTheDocument()
    expect(screen.getByText('Configurações')).toBeInTheDocument()
  })

  it('deve mostrar estado de loading', () => {
    mockUseAccessibleMenuTree.mockReturnValue({
      menuTree: [],
      isLoading: true,
      error: null
    })
    
    renderAppSidebar()
    
    expect(screen.getByText('Carregando...')).toBeInTheDocument()
  })

  it('deve mostrar estado de erro', () => {
    mockUseAccessibleMenuTree.mockReturnValue({
      menuTree: [],
      isLoading: false,
      error: 'Erro ao carregar menu'
    })
    
    renderAppSidebar()
    
    expect(screen.getByText('Erro')).toBeInTheDocument()
    expect(screen.getByText('Erro ao carregar menu: Erro ao carregar menu')).toBeInTheDocument()
  })

  it('deve renderizar sidebar colapsado', () => {
    mockUseSidebar.mockReturnValue({
      state: 'collapsed',
      open: false,
      setOpen: vi.fn(),
      openMobile: false,
      setOpenMobile: vi.fn(),
      isMobile: false,
      toggleSidebar: vi.fn()
    })
    
    renderAppSidebar()
    
    const sidebar = screen.getByRole('complementary')
    expect(sidebar).toHaveClass('collapsed')
  })

  it('deve chamar signOut ao clicar no botão de logout', async () => {
    const mockSignOut = vi.fn()
    mockUseAuth.mockReturnValue({
      user: mockUser,
      userProfile: mockUserProfile,
      signOut: mockSignOut,
      signIn: vi.fn(),
      signUp: vi.fn(),
      resetPassword: vi.fn(),
      session: null,
      loading: false
    })
    
    renderAppSidebar()
    
    const logoutButton = screen.getByRole('button', { name: /sair/i })
    fireEvent.click(logoutButton)
    
    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith('/auth')
    })
  })

  it('deve renderizar fallback de configurações quando usuário tem acesso mas não há itens', () => {
    mockUseAccessibleMenuTree.mockReturnValue({
      menuTree: [mockMenuItems[0]], // Apenas dashboard, sem config
      isLoading: false,
      error: null
    })
    
    renderAppSidebar()
    
    // Deve mostrar o link de configurações como fallback
    const configLinks = screen.getAllByText('Configurações')
    expect(configLinks.length).toBeGreaterThan(0)
  })

  it('deve separar corretamente itens principais dos de configuração', () => {
    const mixedMenuItems = [
      {
        id: '1',
        name: 'Dashboard',
        path: '/dashboard',
        icon: 'home',
        parent_id: null,
        order_index: 1,
        is_active: true,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        children: []
      },
      {
        id: '2',
        name: 'Usuários',
        path: '/config/users',
        icon: 'users',
        parent_id: null,
        order_index: 2,
        is_active: true,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        children: []
      }
    ]
    
    mockUseAccessibleMenuTree.mockReturnValue({
      menuTree: mixedMenuItems,
      isLoading: false,
      error: null
    })
    
    renderAppSidebar()
    
    expect(screen.getByText('Principal')).toBeInTheDocument()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Configurações')).toBeInTheDocument()
    expect(screen.getByText('Usuários')).toBeInTheDocument()
  })
})