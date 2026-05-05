import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BalancetesPage from '../page'

const mockLoadBalancetes = vi.fn()
const mockLoadCondominiums = vi.fn()
const mockLoadProtocolos = vi.fn()
const mockMarkAsSent = vi.fn()
const mockListByProtocolos = vi.fn()
const mockListByBalancetes = vi.fn()
const extractStatusValue = (value: any): string => {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(extractStatusValue).join('')
  if (value?.props?.children) return extractStatusValue(value.props.children)
  return ''
}
const extractClassName = (value: any): string => {
  if (typeof value?.props?.className === 'string') return value.props.className
  return ''
}

const mockTabelaOmnia = vi.fn(({ columns, data, onSelectionChange, disabledIds }: any) => (
  <div>
    <div data-testid="columns">{columns.map((column: any) => column.label).join('|')}</div>
    <div data-testid="row-names">{data.map((row: any) => row.condominium_name).join('|')}</div>
    <div data-testid="tipo-values">{data.map((row: any) => row.tipo_envio).join('|')}</div>
    <div data-testid="status-values">{data.map((row: any) => extractStatusValue(row.sent_status)).join('|')}</div>
    <div data-testid="status-classes">{data.map((row: any) => extractClassName(row.sent_status)).join('|')}</div>
    <div data-testid="disabled-ids">{Array.from(disabledIds ?? []).join('|')}</div>
    <button onClick={() => !disabledIds?.has?.('1') && onSelectionChange?.(new Set(['1']))}>Selecionar balancete digital</button>
    <button onClick={() => onSelectionChange?.(new Set(['2']))}>Selecionar balancete impresso</button>
  </div>
))

vi.mock('@/components/layout/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))

vi.mock('@/components/ui/breadcrumb-omnia', () => ({
  BreadcrumbOmnia: () => <div>Breadcrumb</div>,
}))

vi.mock('@/components/ui/tabela-omnia', () => ({
  TabelaOmnia: (props: any) => mockTabelaOmnia(props),
}))

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuLabel: ({ children }: any) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuRadioGroup: ({ value, onValueChange, children }: any) => (
    <div data-testid="radio-filter" data-value={value}>
      {React.Children.map(children, (child: any) =>
        React.isValidElement(child)
          ? React.cloneElement(child as React.ReactElement<any>, { onSelectValue: onValueChange })
          : child
      )}
    </div>
  ),
  DropdownMenuRadioItem: ({ value, children, onSelectValue }: any) => (
    <button role="menuitemradio" onClick={() => onSelectValue?.(value)}>
      {children}
    </button>
  ),
  DropdownMenuCheckboxItem: ({ checked, children, onCheckedChange }: any) => (
    <button
      role="menuitemcheckbox"
      aria-checked={checked}
      onClick={() => onCheckedChange?.(!checked)}
    >
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/sliding-tabs', () => ({
  default: ({ items }: any) => (
    <div>
      {items.map((item: any) => (
        <section key={item.key}>{item.panel}</section>
      ))}
    </div>
  ),
}))

vi.mock('@/components/balancetes/BalancetesDashboard', () => ({
  BalancetesDashboard: ({ onCondominiumClick }: any) => (
    <button onClick={() => onCondominiumClick?.('cond-1', '02/2026')}>Dashboard</button>
  ),
}))

vi.mock('@/components/balancetes/ProtocolosTab', () => ({
  ProtocolosTab: () => <div>Protocolos</div>,
}))

vi.mock('@/components/balancetes/ProtocoloAttachmentUpload', () => ({
  ProtocoloAttachmentUpload: () => null,
}))

vi.mock('@/components/balancetes/BalanceteForm', () => ({
  BalanceteForm: ({ open, initialCondominiumId, lockCondominium, initialCompetencia }: any) => (
    <div>
      <div data-testid="form-open">{String(open)}</div>
      <div data-testid="form-condominium">{initialCondominiumId ?? ''}</div>
      <div data-testid="form-lock">{String(lockCondominium)}</div>
      <div data-testid="form-competencia">{initialCompetencia ?? ''}</div>
    </div>
  ),
}))

vi.mock('@/stores/balancetes.store', () => ({
  useBalancetesStore: () => ({
    balancetes: [
      {
        id: '1',
        condominium_id: 'cond-1',
        condominium_name: 'Condomínio Digital',
        balancete_digital: true,
        received_at: '2026-04-01',
        competencia: '03/2026',
        volumes: 1,
        observations: null,
        status: 'received',
        sent_at: null,
        protocolo_id: null,
        created_at: null,
        updated_at: null,
      },
      {
        id: '2',
        condominium_id: 'cond-2',
        condominium_name: 'Condomínio Impresso',
        balancete_digital: false,
        received_at: '2026-04-02',
        competencia: '03/2026',
        volumes: 2,
        observations: null,
        status: 'received',
        sent_at: null,
        protocolo_id: null,
        created_at: null,
        updated_at: null,
      },
      {
        id: '3',
        condominium_id: 'cond-3',
        condominium_name: 'Condomínio Enviado',
        balancete_digital: false,
        received_at: '2026-04-03',
        competencia: '03/2026',
        volumes: 1,
        observations: null,
        status: 'received',
        sent_at: '2026-04-10',
        protocolo_id: 'proto-1',
        created_at: null,
        updated_at: null,
      },
    ],
    loading: false,
    loadBalancetes: mockLoadBalancetes,
    createBalancete: vi.fn(),
    updateBalancete: vi.fn(),
    deleteBalancete: vi.fn(),
    markAsSent: mockMarkAsSent,
  }),
}))

vi.mock('@/stores/condominiums.store', () => ({
  useCondominiumStore: () => ({
    condominiums: [
      {
        id: 'cond-1',
        name: 'Condomínio Digital',
        active: true,
        balancete_digital: true,
        created_at: null,
        updated_at: null,
      },
    ],
    loadCondominiums: mockLoadCondominiums,
  }),
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({
    userProfile: { id: 'user-1' },
  }),
}))

vi.mock('@/stores/protocolos.store', () => ({
  useProtocolosStore: () => ({
    protocolos: [
      {
        id: 'proto-1',
        numero: 123,
        data_envio: '2026-04-10',
      },
    ],
    loadProtocolos: mockLoadProtocolos,
  }),
}))

vi.mock('@/repositories/protocoloAttachmentsRepo.supabase', () => ({
  protocoloAttachmentsRepoSupabase: {
    listByProtocolo: vi.fn(),
    listByProtocolos: (...args: any[]) => mockListByProtocolos(...args),
  },
}))

vi.mock('@/repositories/balanceteAttachmentsRepo.supabase', () => ({
  balanceteAttachmentsRepoSupabase: {
    listByBalancete: vi.fn(),
    listByBalancetes: (...args: any[]) => mockListByBalancetes(...args),
  },
}))

vi.mock('@/repositories/protocolosRepo.supabase', () => ({
  protocolosRepoSupabase: {
    getById: vi.fn(),
  },
}))

vi.mock('@/lib/generateProtocoloPDF', () => ({
  generateProtocoloPDF: vi.fn(),
  downloadPDF: vi.fn(),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

describe('BalancetesPage', () => {
  beforeEach(() => {
    mockListByProtocolos.mockResolvedValue([])
    mockListByBalancetes.mockResolvedValue([])
  })

  it('inclui a coluna Tipo com D para digital e I para impresso', async () => {
    render(<BalancetesPage />)

    await waitFor(() => expect(mockTabelaOmnia).toHaveBeenCalled())

    expect(screen.getByTestId('columns')).toHaveTextContent('Tipo')
    expect(screen.getByTestId('tipo-values')).toHaveTextContent('I|I')
  })

  it('aplica como padrao apenas os status pendente e enviado', async () => {
    render(<BalancetesPage />)

    await waitFor(() => expect(mockTabelaOmnia).toHaveBeenCalled())

    expect(screen.getByTestId('row-names')).not.toHaveTextContent('Condomínio Digital')
    expect(screen.getByTestId('row-names')).toHaveTextContent('Condomínio Impresso')
    expect(screen.getByTestId('row-names')).toHaveTextContent('Condomínio Enviado')
  })

  it('mostra status Digital quando o filtro digital esta selecionado', async () => {
    render(<BalancetesPage />)

    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Digital' }))

    await waitFor(() => {
      expect(screen.getByTestId('status-values')).toHaveTextContent('Digital')
    })

    expect(screen.getByTestId('status-values')).toHaveTextContent('Pendente')
    expect(screen.getByTestId('status-values')).toHaveTextContent('10/04/2026')
  })

  it('combina filtros de status ao selecionar Digital junto com os demais', async () => {
    render(<BalancetesPage />)

    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Digital' }))

    await waitFor(() => {
      expect(screen.getByTestId('row-names')).toHaveTextContent('Condomínio Digital')
      expect(screen.getByTestId('row-names')).toHaveTextContent('Condomínio Impresso')
      expect(screen.getByTestId('row-names')).toHaveTextContent('Condomínio Enviado')
    })
  })

  it('nao permite selecionar balancete digital para envio', async () => {
    render(<BalancetesPage />)

    await waitFor(() => expect(mockTabelaOmnia).toHaveBeenCalled())

    expect(screen.getByTestId('disabled-ids')).toHaveTextContent('1|3')

    fireEvent.click(screen.getByRole('button', { name: 'Selecionar balancete digital' }))
    expect(screen.getByRole('button', { name: /^Enviar$/ })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Selecionar balancete impresso' }))
    expect(screen.getByRole('button', { name: 'Enviar (1)' })).toBeEnabled()
  })

  it('abre novo balancete pelo clique no condominio do dashboard com condominio travado', async () => {
    render(<BalancetesPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Dashboard' }))

    await waitFor(() => expect(screen.getByTestId('form-open')).toHaveTextContent('true'))
    expect(screen.getByTestId('form-condominium')).toHaveTextContent('cond-1')
    expect(screen.getByTestId('form-lock')).toHaveTextContent('true')
    expect(screen.getByTestId('form-competencia')).toHaveTextContent('03/2026')
  })

  it('abre o popup de envio com a data padrao como amanha', async () => {
    const amanha = new Date()
    amanha.setDate(amanha.getDate() + 1)
    const expectedDate = amanha.toISOString().split('T')[0]

    render(<BalancetesPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Selecionar balancete impresso' }))
    fireEvent.click(screen.getByRole('button', { name: 'Enviar (1)' }))

    await waitFor(() => {
      expect(document.getElementById('dataEnvio')).toHaveValue(expectedDate)
    })
  })

  it('marca a data de envio em vermelho quando o balancete enviado nao possui protocolo anexado', async () => {
    render(<BalancetesPage />)

    await waitFor(() => expect(mockTabelaOmnia).toHaveBeenCalled())

    expect(screen.getByTestId('status-values')).toHaveTextContent('10/04/2026')
    expect(screen.getByTestId('status-classes')).toHaveTextContent('text-red-700')
  })
})
