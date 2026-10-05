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
    expect(create).toHaveBeenCalledWith({name:'Robô',audience:'mcp',scopes:['tasks:read'],expiresAt:expect.any(String)})
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
    expect(create).toHaveBeenCalledWith({name:'Automação — nova',audience:'api',scopes:['tasks:read'],expiresAt:expect.any(String)})
    expect(revoke).toHaveBeenCalledWith('old')
    expect(create.mock.invocationCallOrder[0]).toBeLessThan(revoke.mock.invocationCallOrder[0])
  })

  describe('status filter', () => {
    const base={audience:'api' as const,scopes:['tasks:read'],createdAt:'2026-10-04T10:00:00Z',lastUsedAt:null}
    const active={...base,id:'a',name:'Chave ativa',expiresAt:'2999-01-02T10:00:00Z',revokedAt:null}
    const expired={...base,id:'e',name:'Chave expirada',expiresAt:'2026-10-05T10:00:00Z',revokedAt:null}
    const revoked={...base,id:'r',name:'Chave revogada',expiresAt:'2999-01-02T10:00:00Z',revokedAt:'2026-10-04T11:00:00Z'}
    const radio=(name:RegExp)=>screen.getByRole('radio',{name})

    it('shows only non-revoked keys by default, including expired ones that can still be acted on', async () => {
      list.mockResolvedValue([revoked,active,expired])
      render(<IntegracoesPage />)
      expect(await screen.findByText('Chave ativa')).toBeInTheDocument()
      expect(screen.getByText('Chave expirada')).toBeInTheDocument()
      expect(screen.queryByText('Chave revogada')).not.toBeInTheDocument()
      expect(radio(/Ativas/)).toBeChecked()
      expect(radio(/Revogadas/)).not.toBeChecked()
      expect(screen.getAllByRole('button',{name:/Revogar/i})).toHaveLength(2)
    })
    it('switches to revoked keys only, without management actions', async () => {
      list.mockResolvedValue([revoked,active,expired])
      render(<IntegracoesPage />)
      await screen.findByText('Chave ativa')
      fireEvent.click(radio(/Revogadas/))
      expect(screen.getByText('Chave revogada')).toBeInTheDocument()
      expect(screen.queryByText('Chave ativa')).not.toBeInTheDocument()
      expect(screen.queryByText('Chave expirada')).not.toBeInTheDocument()
      expect(screen.queryByRole('button',{name:/Substituir|Revogar/i})).not.toBeInTheDocument()
      fireEvent.click(radio(/Ativas/))
      expect(screen.getByText('Chave ativa')).toBeInTheDocument()
      expect(screen.queryByText('Chave revogada')).not.toBeInTheDocument()
    })
    it('shows how many keys each option holds', async () => {
      list.mockResolvedValue([revoked,{...revoked,id:'r2',name:'Outra revogada'},active,expired])
      render(<IntegracoesPage />)
      await screen.findByText('Chave ativa')
      expect(radio(/Ativas/)).toHaveTextContent('2')
      expect(radio(/Revogadas/)).toHaveTextContent('2')
    })
    it('keeps a selection when the same option is pressed again', async () => {
      list.mockResolvedValue([revoked,active])
      render(<IntegracoesPage />)
      await screen.findByText('Chave ativa')
      fireEvent.click(radio(/Revogadas/))
      fireEvent.click(radio(/Revogadas/))
      expect(radio(/Revogadas/)).toBeChecked()
      expect(screen.getByText('Chave revogada')).toBeInTheDocument()
    })
    it('explains an empty view and points to the other option instead of the creation hint', async () => {
      list.mockResolvedValue([revoked])
      render(<IntegracoesPage />)
      expect(await screen.findByText(/Nenhuma chave ativa/i)).toBeInTheDocument()
      expect(screen.queryByText(/Nenhuma chave criada/i)).not.toBeInTheDocument()
      list.mockResolvedValue([active])
    })
    it('explains when no key was ever revoked', async () => {
      list.mockResolvedValue([active])
      render(<IntegracoesPage />)
      await screen.findByText('Chave ativa')
      fireEvent.click(radio(/Revogadas/))
      expect(screen.getByText(/Nenhuma chave revogada/i)).toBeInTheDocument()
    })
    it('keeps the creation hint when there are no keys at all', async () => {
      render(<IntegracoesPage />)
      expect(await screen.findByText(/Nenhuma chave criada/i)).toBeInTheDocument()
    })
    it('moves a key to the revoked option after revoking it, keeping the current filter', async () => {
      vi.stubGlobal('confirm',vi.fn(()=>true))
      list.mockResolvedValueOnce([active,revoked]).mockResolvedValue([{...active,revokedAt:'2026-10-05T10:00:00Z'},revoked])
      revoke.mockResolvedValue({...active,revokedAt:'2026-10-05T10:00:00Z'})
      render(<IntegracoesPage />)
      fireEvent.click(await screen.findByRole('button',{name:/Revogar/i}))
      await waitFor(()=>expect(screen.queryByText('Chave ativa')).not.toBeInTheDocument())
      expect(radio(/Ativas/)).toBeChecked()
      expect(radio(/Revogadas/)).toHaveTextContent('2')
      fireEvent.click(radio(/Revogadas/))
      expect(screen.getByText('Chave ativa')).toBeInTheDocument()
    })
  })

  describe('key lifetime', () => {
    const DAY=86_400_000
    const key={id:'k',name:'Automação',audience:'api' as const,scopes:['tasks:read'],createdAt:'2026-10-04T10:00:00Z',expiresAt:'2999-01-02T10:00:00Z',revokedAt:null,lastUsedAt:null}
    const radio=(name:RegExp)=>screen.getByRole('radio',{name})
    const submit=async(duration?:RegExp)=>{
      render(<IntegracoesPage />)
      await screen.findByText(/Nenhuma chave/)
      fireEvent.change(screen.getByLabelText(/Nome da chave/i),{target:{value:'Robô'}})
      if (duration) fireEvent.click(radio(duration))
      const before=Date.now()
      create.mockResolvedValue({...key,token:'omnia_api_t'})
      fireEvent.click(screen.getByRole('button',{name:/Criar chave/i}))
      await screen.findByText('omnia_api_t')
      return {before,after:Date.now(),sent:create.mock.calls[0][0] as {expiresAt:string|null}}
    }

    it('offers 7, 30 and 90 days or no deadline, with 90 days selected', async () => {
      render(<IntegracoesPage />)
      await screen.findByText(/Nenhuma chave/)
      for (const label of [/7 dias/,/30 dias/,/90 dias/,/Sem prazo/]) expect(radio(label)).toBeInTheDocument()
      expect(radio(/90 dias/)).toBeChecked()
    })
    it.each([[/7 dias/,7],[/30 dias/,30],[/90 dias/,90]])('creates the key expiring in the chosen number of days (%s)', async (label,days) => {
      const {before,after,sent}=await submit(label)
      const at=Date.parse(sent.expiresAt as string)
      expect(at).toBeGreaterThanOrEqual(before+days*DAY)
      expect(at).toBeLessThanOrEqual(after+days*DAY)
    })
    it('keeps the 90-day default when the lifetime is not touched', async () => {
      const {before,after,sent}=await submit()
      const at=Date.parse(sent.expiresAt as string)
      expect(at).toBeGreaterThanOrEqual(before+90*DAY)
      expect(at).toBeLessThanOrEqual(after+90*DAY)
    })
    it('sends an explicit null for a key without deadline and warns that only revocation ends it', async () => {
      render(<IntegracoesPage />)
      await screen.findByText(/Nenhuma chave/)
      expect(screen.queryByText(/só deixa de funcionar quando for revogada/i)).not.toBeInTheDocument()
      fireEvent.click(radio(/Sem prazo/))
      expect(screen.getByText(/só deixa de funcionar quando for revogada/i)).toBeInTheDocument()
      fireEvent.change(screen.getByLabelText(/Nome da chave/i),{target:{value:'Perene'}})
      create.mockResolvedValue({...key,expiresAt:null,token:'omnia_api_t'})
      fireEvent.click(screen.getByRole('button',{name:/Criar chave/i}))
      await screen.findByText('omnia_api_t')
      expect(create).toHaveBeenCalledWith({name:'Perene',audience:'api',scopes:['tasks:read'],expiresAt:null})
    })
    it('lists a key without deadline as active with no expiry date', async () => {
      list.mockResolvedValue([{...key,expiresAt:null}])
      render(<IntegracoesPage />)
      expect(await screen.findByText('Automação')).toBeInTheDocument()
      expect(screen.getByText('Ativa')).toBeInTheDocument()
      expect(screen.getByText(/Sem prazo de expiração/)).toBeInTheDocument()
      expect(screen.queryByText(/Expira em/)).not.toBeInTheDocument()
    })
    it('still flags a finite key past its deadline as expired', async () => {
      list.mockResolvedValue([{...key,expiresAt:'2026-10-05T10:00:00Z'}])
      render(<IntegracoesPage />)
      expect(await screen.findByText('Expirada')).toBeInTheDocument()
    })
    it.each([
      ['no deadline',null,'2026-10-04T10:00:00Z',/Sem prazo/],
      ['a 7-day key','2026-10-11T10:00:00Z','2026-10-04T10:00:00Z',/7 dias/],
      ['a 30-day key','2026-11-03T10:00:00Z','2026-10-04T10:00:00Z',/30 dias/],
      ['a 90-day key','2027-01-02T10:00:00Z','2026-10-04T10:00:00Z',/90 dias/],
      ['an unusual span','2026-10-20T10:00:00Z','2026-10-04T10:00:00Z',/90 dias/],
    ])('preselects the same lifetime when replacing %s', async (_,expiresAt,createdAt,expected) => {
      list.mockResolvedValue([{...key,expiresAt,createdAt}])
      render(<IntegracoesPage />)
      fireEvent.click(await screen.findByRole('button',{name:/Substituir/i}))
      expect(radio(expected)).toBeChecked()
    })
  })
})
