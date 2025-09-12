import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Auth from '../Auth'
import { AuthProvider } from '@/contexts/AuthContext'

// Mock do useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate
  }
})

// Mock do Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      getSession: vi.fn(() => Promise.resolve({ data: { session: null } }))
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null }))
        }))
      }))
    }))
  }
}))

// Wrapper para testes
const AuthWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <AuthProvider>
      {children}
    </AuthProvider>
  </BrowserRouter>
)

describe('Auth Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deve renderizar o formulário de login corretamente', () => {
    render(
      <AuthWrapper>
        <Auth />
      </AuthWrapper>
    )

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/senha/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument()
    expect(screen.getByText(/esqueci minha senha/i)).toBeInTheDocument()
  })

  it('deve mostrar o logo da aplicação', () => {
    render(
      <AuthWrapper>
        <Auth />
      </AuthWrapper>
    )

    const logo = screen.getByAltText(/omnia logo/i)
    expect(logo).toBeInTheDocument()
    expect(logo).toHaveAttribute('src', '/lovable-uploads/6d3076bc-69b6-4b0c-bc8b-2589689cae6a.png')
  })

  it('deve permitir inserir email e senha', async () => {
    render(
      <AuthWrapper>
        <Auth />
      </AuthWrapper>
    )

    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/senha/i)

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })

    expect(emailInput).toHaveValue('test@example.com')
    expect(passwordInput).toHaveValue('password123')
  })

  it('deve mostrar estado de loading durante o login', async () => {
    const { supabase } = await import('@/integrations/supabase/client')
    vi.mocked(supabase.auth.signInWithPassword).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ 
        data: { user: null, session: null }, 
        error: null 
      }), 100))
    )

    render(
      <AuthWrapper>
        <Auth />
      </AuthWrapper>
    )

    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/senha/i)
    const submitButton = screen.getByRole('button', { name: /entrar/i })

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.click(submitButton)

    expect(screen.getByText(/entrando.../i)).toBeInTheDocument()
    expect(submitButton).toBeDisabled()
  })

  it('deve exibir erro quando login falha', async () => {
    const { supabase } = await import('@/integrations/supabase/client')
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null },
      error: { 
        message: 'Invalid login credentials',
        code: 'invalid_credentials',
        status: 400,
        __isAuthError: true,
        name: 'AuthError'
      }
    })

    render(
      <AuthWrapper>
        <Auth />
      </AuthWrapper>
    )

    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/senha/i)
    const submitButton = screen.getByRole('button', { name: /entrar/i })

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/email ou senha incorretos/i)).toBeInTheDocument()
    })
  })

  it('deve alternar para formulário de recuperação de senha', () => {
    render(
      <AuthWrapper>
        <Auth />
      </AuthWrapper>
    )

    const forgotPasswordLink = screen.getByText(/esqueci minha senha/i)
    fireEvent.click(forgotPasswordLink)

    expect(screen.getByRole('button', { name: /enviar email de recuperação/i })).toBeInTheDocument()
    expect(screen.getByText(/voltar ao login/i)).toBeInTheDocument()
  })

  it('deve enviar email de recuperação de senha', async () => {
    const { supabase } = await import('@/integrations/supabase/client')
    vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({ 
      data: {}, 
      error: null 
    })

    render(
      <AuthWrapper>
        <Auth />
      </AuthWrapper>
    )

    // Alternar para formulário de recuperação
    fireEvent.click(screen.getByText(/esqueci minha senha/i))

    const emailInput = screen.getByLabelText(/email/i)
    const submitButton = screen.getByRole('button', { name: /enviar email de recuperação/i })

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/email de recuperação enviado/i)).toBeInTheDocument()
    })

    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      'test@example.com',
      { redirectTo: `${window.location.origin}/reset-password` }
    )
  })

  it('deve exibir erro quando recuperação de senha falha', async () => {
    const { supabase } = await import('@/integrations/supabase/client')
    vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({
      data: null,
      error: { 
        message: 'Email not found',
        code: 'email_not_found',
        status: 400,
        __isAuthError: true,
        name: 'AuthError'
      }
    })

    render(
      <AuthWrapper>
        <Auth />
      </AuthWrapper>
    )

    // Alternar para formulário de recuperação
    fireEvent.click(screen.getByText(/esqueci minha senha/i))

    const emailInput = screen.getByLabelText(/email/i)
    const submitButton = screen.getByRole('button', { name: /enviar email de recuperação/i })

    fireEvent.change(emailInput, { target: { value: 'invalid@example.com' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/erro ao enviar email de recuperação/i)).toBeInTheDocument()
    })
  })

  it('deve voltar ao formulário de login a partir da recuperação', () => {
    render(
      <AuthWrapper>
        <Auth />
      </AuthWrapper>
    )

    // Ir para recuperação
    fireEvent.click(screen.getByText(/esqueci minha senha/i))
    expect(screen.getByRole('button', { name: /enviar email de recuperação/i })).toBeInTheDocument()

    // Voltar ao login
    fireEvent.click(screen.getByText(/voltar ao login/i))
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument()
  })

  it('deve validar campos obrigatórios', () => {
    render(
      <AuthWrapper>
        <Auth />
      </AuthWrapper>
    )

    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/senha/i)

    expect(emailInput).toHaveAttribute('required')
    expect(passwordInput).toHaveAttribute('required')
    expect(emailInput).toHaveAttribute('type', 'email')
    expect(passwordInput).toHaveAttribute('type', 'password')
  })
})