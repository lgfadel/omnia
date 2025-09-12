import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { AuthProvider, useAuth } from '../AuthContext'
import { User, Session } from '@supabase/supabase-js'

// Mock do Supabase
vi.mock('@/integrations/supabase/client', () => {
  const mockOnAuthStateChange = vi.fn()
  const mockGetSession = vi.fn()
  const mockSignUp = vi.fn()
  const mockSignInWithPassword = vi.fn()
  const mockSignOut = vi.fn()
  const mockResetPasswordForEmail = vi.fn()
  const mockFrom = vi.fn()
  
  return {
    supabase: {
      auth: {
        onAuthStateChange: mockOnAuthStateChange,
        getSession: mockGetSession,
        signUp: mockSignUp,
        signInWithPassword: mockSignInWithPassword,
        signOut: mockSignOut,
        resetPasswordForEmail: mockResetPasswordForEmail
      },
      from: mockFrom
    }
  }
})

// Mock dos fixtures
vi.mock('@/data/fixtures', () => ({
  UserRef: {},
  Role: {}
}))

// Componente de teste para usar o hook
function TestComponent() {
  const auth = useAuth()
  
  return (
    <div>
      <div data-testid="loading">{auth.loading ? 'loading' : 'not-loading'}</div>
      <div data-testid="user">{auth.user ? auth.user.email : 'no-user'}</div>
      <div data-testid="session">{auth.session ? 'has-session' : 'no-session'}</div>
      <div data-testid="user-profile">{auth.userProfile ? auth.userProfile.name : 'no-profile'}</div>
      <button onClick={() => auth.signIn('test@example.com', 'password')}>Sign In</button>
      <button onClick={() => auth.signOut()}>Sign Out</button>
      <button onClick={() => auth.signUp('test@example.com', 'password', 'Test User')}>Sign Up</button>
      <button onClick={() => auth.resetPassword('test@example.com')}>Reset Password</button>
    </div>
  )
}

// Mock de usuário e sessão
const mockUser: User = {
  id: 'user-123',
  email: 'test@example.com',
  aud: 'authenticated',
  role: 'authenticated',
  email_confirmed_at: '2023-01-01T00:00:00Z',
  phone_confirmed_at: null,
  confirmation_sent_at: '2023-01-01T00:00:00Z',
  recovery_sent_at: null,
  email_change_sent_at: null,
  new_email: null,
  new_phone: null,
  invited_at: null,
  action_link: null,
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z',
  is_anonymous: false,
  app_metadata: {},
  user_metadata: {}
}

const mockSession: Session = {
  access_token: 'access-token',
  refresh_token: 'refresh-token',
  expires_in: 3600,
  expires_at: Date.now() / 1000 + 3600,
  token_type: 'bearer',
  user: mockUser
}

const mockUserProfile = {
  id: 'profile-123',
  name: 'Test User',
  email: 'test@example.com',
  roles: [],
  avatarUrl: null,
  color: '#000000'
}

describe('AuthContext', () => {
  let mockOnAuthStateChange: any
  let mockGetSession: any
  let mockSignUp: any
  let mockSignInWithPassword: any
  let mockSignOut: any
  let mockResetPasswordForEmail: any
  let mockFrom: any
  let mockSelect: any
  let mockEq: any
  let mockMaybeSingle: any

  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Get mocked functions
    const { supabase } = await import('@/integrations/supabase/client')
    mockOnAuthStateChange = vi.mocked(supabase.auth.onAuthStateChange)
    mockGetSession = vi.mocked(supabase.auth.getSession)
    mockSignUp = vi.mocked(supabase.auth.signUp)
    mockSignInWithPassword = vi.mocked(supabase.auth.signInWithPassword)
    mockSignOut = vi.mocked(supabase.auth.signOut)
    mockResetPasswordForEmail = vi.mocked(supabase.auth.resetPasswordForEmail)
    mockFrom = vi.mocked(supabase.from)
    
    mockSelect = vi.fn()
    mockEq = vi.fn()
    mockMaybeSingle = vi.fn()
    
    // Setup default mocks
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } }
    })
    
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null
    })
    
    mockFrom.mockReturnValue({
      select: mockSelect.mockReturnValue({
        eq: mockEq.mockReturnValue({
          maybeSingle: mockMaybeSingle.mockResolvedValue({
            data: null,
            error: null
          })
        })
      })
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('deve fornecer valores iniciais corretos', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    expect(screen.getByTestId('loading')).toHaveTextContent('loading')
    expect(screen.getByTestId('user')).toHaveTextContent('no-user')
    expect(screen.getByTestId('session')).toHaveTextContent('no-session')
    expect(screen.getByTestId('user-profile')).toHaveTextContent('no-profile')

    // Aguardar o loading terminar
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading')
    })
  })

  it('deve configurar listener de mudança de estado de autenticação', () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    expect(mockOnAuthStateChange).toHaveBeenCalledWith(expect.any(Function))
  })

  it('deve buscar sessão existente na inicialização', () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    expect(mockGetSession).toHaveBeenCalled()
  })

  it('deve atualizar estado quando usuário faz login', async () => {
    let authStateCallback: (event: string, session: Session | null) => void
    
    mockOnAuthStateChange.mockImplementation((callback) => {
      authStateCallback = callback
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })

    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 'profile-123',
        name: 'Test User',
        email: 'test@example.com',
        roles: [],
        avatar_url: null,
        color: '#000000'
      },
      error: null
    })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    // Simular login
    await act(async () => {
      authStateCallback!('SIGNED_IN', mockSession)
      // Aguardar o setTimeout para fetchUserProfile
      await new Promise(resolve => setTimeout(resolve, 10))
    })

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com')
      expect(screen.getByTestId('session')).toHaveTextContent('has-session')
    })

    await waitFor(() => {
      expect(screen.getByTestId('user-profile')).toHaveTextContent('Test User')
    })
  })

  it('deve limpar estado quando usuário faz logout', async () => {
    let authStateCallback: (event: string, session: Session | null) => void
    
    mockOnAuthStateChange.mockImplementation((callback) => {
      authStateCallback = callback
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    // Primeiro fazer login
    await act(async () => {
      authStateCallback!('SIGNED_IN', mockSession)
    })

    // Depois fazer logout
    await act(async () => {
      authStateCallback!('SIGNED_OUT', null)
    })

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('no-user')
      expect(screen.getByTestId('session')).toHaveTextContent('no-session')
      expect(screen.getByTestId('user-profile')).toHaveTextContent('no-profile')
    })
  })

  it('deve chamar signIn corretamente', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: mockUser, session: mockSession },
      error: null
    })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await act(async () => {
      screen.getByText('Sign In').click()
    })

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password'
    })
  })

  it('deve chamar signUp corretamente', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: mockUser, session: null },
      error: null
    })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await act(async () => {
      screen.getByText('Sign Up').click()
    })

    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password',
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { name: 'Test User' }
      }
    })
  })

  it('deve chamar signOut corretamente', async () => {
    mockSignOut.mockResolvedValue({ error: null })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await act(async () => {
      screen.getByText('Sign Out').click()
    })

    expect(mockSignOut).toHaveBeenCalled()
  })

  it('deve chamar resetPassword corretamente', async () => {
    mockResetPasswordForEmail.mockResolvedValue({
      data: {},
      error: null
    })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await act(async () => {
      screen.getByText('Reset Password').click()
    })

    expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
      'test@example.com',
      { redirectTo: `${window.location.origin}/reset-password` }
    )
  })

  it('deve lidar com erro na busca de perfil do usuário', async () => {
    let authStateCallback: (event: string, session: Session | null) => void
    
    mockOnAuthStateChange.mockImplementation((callback) => {
      authStateCallback = callback
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })

    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'Profile not found' }
    })

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await act(async () => {
      authStateCallback!('SIGNED_IN', mockSession)
      await new Promise(resolve => setTimeout(resolve, 10))
    })

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching user profile:', { message: 'Profile not found' })
    })

    consoleSpy.mockRestore()
  })

  it('deve lidar com erro na verificação de sessão', async () => {
    mockGetSession.mockRejectedValue(new Error('Session check failed'))
    
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Auth session check failed:', expect.any(Error))
      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading')
    })

    consoleSpy.mockRestore()
  })

  it('deve lançar erro quando useAuth é usado fora do AuthProvider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    expect(() => {
      render(<TestComponent />)
    }).toThrow('useAuth must be used within an AuthProvider')

    consoleSpy.mockRestore()
  })

  it('deve limpar estado local mesmo quando signOut falha', async () => {
    mockSignOut.mockRejectedValue(new Error('Network error'))
    
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await act(async () => {
      screen.getByText('Sign Out').click()
    })

    expect(consoleSpy).toHaveBeenCalledWith('Error signing out:', expect.any(Error))
    
    consoleSpy.mockRestore()
  })
})