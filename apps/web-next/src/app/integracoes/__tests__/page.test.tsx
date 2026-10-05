import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import IntegracoesPage from '../page'

const { list, create, revoke } = vi.hoisted(() => ({list:vi.fn(),create:vi.fn(),revoke:vi.fn()}))
vi.mock('@/repositories/integrationKeysRepo.api', () => ({integrationKeysRepo:{list,create,revoke}}))
vi.mock('@/components/layout/Layout', () => ({Layout:({children}:{children:React.ReactNode})=><div>{children}</div>}))
vi.mock('@/components/auth/ProtectedRoute', () => ({ProtectedRoute:({children}:{children:React.ReactNode})=><div>{children}</div>}))
vi.mock('@/hooks/use-toast', () => ({useToast:()=>({toast:vi.fn()})}))

beforeEach(() => {vi.stubGlobal('ResizeObserver',class {observe(){} unobserve(){} disconnect(){}});list.mockReset().mockResolvedValue([]);create.mockReset();revoke.mockReset()})
describe('personal integration keys', () => {
  it('shows the issued secret once and clears it on dismissal', async () => {
    create.mockResolvedValue({id:'key',name:'Robô',audience:'mcp',scopes:['tasks:read'],createdAt:'2026-10-04T10:00:00Z',expiresAt:'2027-01-02T10:00:00Z',revokedAt:null,lastUsedAt:null,token:'omnia_mcp_secret'})
    render(<IntegracoesPage />)
    await screen.findByText(/Nenhuma chave/)
    fireEvent.change(screen.getByLabelText(/Nome da chave/i),{target:{value:'Robô'}})
    fireEvent.click(screen.getByLabelText(/MCP/))
    fireEvent.click(screen.getByRole('button',{name:/Criar chave/i}))
    expect(await screen.findByText('omnia_mcp_secret')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:/Concluído/i}))
    await waitFor(()=>expect(screen.queryByText('omnia_mcp_secret')).not.toBeInTheDocument())
    expect(create).toHaveBeenCalledWith({name:'Robô',audience:'mcp',scopes:['tasks:read']})
  })
  it('keeps revoke failure visible after the replacement list refreshes', async () => {
    const key={id:'old',name:'Automação',audience:'api',scopes:['tasks:read'],createdAt:'2026-10-04T10:00:00Z',expiresAt:'2027-01-02T10:00:00Z',revokedAt:null,lastUsedAt:null}
    list.mockResolvedValue([key])
    create.mockResolvedValue({...key,id:'new',token:'omnia_api_new'})
    revoke.mockRejectedValue(new Error('forbidden'))
    render(<IntegracoesPage />)
    fireEvent.click(await screen.findByRole('button',{name:/Substituir/i}))
    fireEvent.click(screen.getByRole('button',{name:/Criar substituta/i}))
    expect(await screen.findByRole('alert')).toHaveTextContent(/Revogue-a manualmente/i)
    expect(screen.getByText('omnia_api_new')).toBeInTheDocument()
  })

  it('creates a replacement before revoking the previous key', async () => {
    const key={id:'old',name:'Automação',audience:'api',scopes:['tasks:read'],createdAt:'2026-10-04T10:00:00Z',expiresAt:'2027-01-02T10:00:00Z',revokedAt:null,lastUsedAt:null}
    list.mockResolvedValue([key])
    create.mockResolvedValue({...key,id:'new',token:'omnia_api_new'})
    revoke.mockResolvedValue({...key,revokedAt:'2026-10-04T11:00:00Z'})
    render(<IntegracoesPage />)
    fireEvent.click(await screen.findByRole('button',{name:/Substituir/i}))
    fireEvent.click(screen.getByRole('button',{name:/Criar substituta/i}))
    await screen.findByText('omnia_api_new')
    expect(create).toHaveBeenCalledWith({name:'Automação — nova',audience:'api',scopes:['tasks:read']})
    expect(revoke).toHaveBeenCalledWith('old')
    expect(create.mock.invocationCallOrder[0]).toBeLessThan(revoke.mock.invocationCallOrder[0])
  })
})
