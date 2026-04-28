import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import BalancetesPage from '../page'

const mockLoadBalancetes = vi.fn()
const mockLoadCondominiums = vi.fn()
const mockLoadProtocolos = vi.fn()
const mockTabelaOmnia = vi.fn(({ columns, data }: any) => (
  <div>
    <div data-testid="columns">{columns.map((column: any) => column.label).join('|')}</div>
    <div data-testid="tipo-values">{data.map((row: any) => row.tipo_envio).join('|')}</div>
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
  BalancetesDashboard: () => <div>Dashboard</div>,
}))

vi.mock('@/components/balancetes/ProtocolosTab', () => ({
  ProtocolosTab: () => <div>Protocolos</div>,
}))

vi.mock('@/components/balancetes/ProtocoloAttachmentUpload', () => ({
  ProtocoloAttachmentUpload: () => null,
}))

vi.mock('@/components/balancetes/BalanceteForm', () => ({
  BalanceteForm: () => null,
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
    ],
    loading: false,
    loadBalancetes: mockLoadBalancetes,
    createBalancete: vi.fn(),
    updateBalancete: vi.fn(),
    deleteBalancete: vi.fn(),
    markAsSent: vi.fn(),
  }),
}))

vi.mock('@/stores/condominiums.store', () => ({
  useCondominiumStore: () => ({
    condominiums: [],
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
    protocolos: [],
    loadProtocolos: mockLoadProtocolos,
  }),
}))

vi.mock('@/repositories/protocoloAttachmentsRepo.supabase', () => ({
  protocoloAttachmentsRepoSupabase: {
    listByProtocolo: vi.fn(),
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
  it('inclui a coluna Tipo com D para digital e I para impresso', async () => {
    render(<BalancetesPage />)

    await waitFor(() => expect(mockTabelaOmnia).toHaveBeenCalled())

    expect(screen.getByTestId('columns')).toHaveTextContent('Tipo')
    expect(screen.getByTestId('tipo-values')).toHaveTextContent('D|I')
  })
})
