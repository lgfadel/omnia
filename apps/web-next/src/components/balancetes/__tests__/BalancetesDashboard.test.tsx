import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BalancetesDashboard } from '../BalancetesDashboard'

vi.mock('@/lib/generateBalancetesRelatorio', () => ({
  generateBalancetesRelatorioPDF: vi.fn(),
}))

vi.mock('@/lib/generateProtocoloPDF', () => ({
  downloadPDF: vi.fn(),
}))

describe('BalancetesDashboard', () => {
  it('exibe o tipo de envio com D para digital e I para impresso', () => {
    render(
      <BalancetesDashboard
        balancetes={[]}
        condominiums={[
          {
            id: 'cond-1',
            name: 'Condomínio Digital',
            cnpj: null,
            address: null,
            number: null,
            neighborhood: null,
            city: null,
            state: null,
            zip_code: null,
            active: true,
            balancete_digital: true,
            boleto_impresso: false,
            created_at: null,
            updated_at: null,
          },
          {
            id: 'cond-2',
            name: 'Condomínio Impresso',
            cnpj: null,
            address: null,
            number: null,
            neighborhood: null,
            city: null,
            state: null,
            zip_code: null,
            active: true,
            balancete_digital: false,
            boleto_impresso: false,
            created_at: null,
            updated_at: null,
          },
        ]}
      />
    )

    expect(screen.getByRole('columnheader', { name: 'Tipo' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'D' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'I' })).toBeInTheDocument()
  })

  it('exibe o analista financeiro do condominio no dashboard', () => {
    render(
      <BalancetesDashboard
        balancetes={[]}
        condominiums={[
          {
            id: 'cond-1',
            name: 'Condominio com Analista',
            cnpj: null,
            address: null,
            number: null,
            neighborhood: null,
            city: null,
            state: null,
            zip_code: null,
            active: true,
            analista_financeiro: 'Marina Souza',
            balancete_digital: true,
            boleto_impresso: false,
            created_at: null,
            updated_at: null,
          },
        ]}
      />
    )

    expect(screen.getByRole('columnheader', { name: 'Analista Financeiro' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Marina Souza' })).toBeInTheDocument()
  })

  it('dispara callback ao clicar no nome do condominio', () => {
    const onCondominiumClick = vi.fn()

    render(
      <BalancetesDashboard
        balancetes={[
          {
            id: 'bal-1',
            condominium_id: 'cond-1',
            received_at: '2026-03-01',
            competencia: '02/2026',
            volumes: 1,
            status: 'received',
            created_at: null,
            updated_at: null,
          },
        ]}
        condominiums={[
          {
            id: 'cond-1',
            name: 'Condominio Clicavel',
            cnpj: null,
            address: null,
            number: null,
            neighborhood: null,
            city: null,
            state: null,
            zip_code: null,
            active: true,
            balancete_digital: true,
            boleto_impresso: false,
            created_at: null,
            updated_at: null,
          },
        ]}
        onCondominiumClick={onCondominiumClick}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Condominio Clicavel' }))

    expect(onCondominiumClick).toHaveBeenCalledWith('cond-1', '02/2026')
  })
})
