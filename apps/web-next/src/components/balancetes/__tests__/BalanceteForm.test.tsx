import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BalanceteForm } from '../BalanceteForm'
import type { Balancete } from '@/repositories/balancetesRepo.supabase'
import type { Condominium } from '@/repositories/condominiumsRepo.supabase'

const condominiums = [
  { id: 'c1', name: 'RESIDENCIAL BIARRITZ', balancete_digital: false, created_at: null, updated_at: null },
] as Condominium[]

function balancete(overrides: Partial<Balancete> = {}): Balancete {
  return {
    id: 'b1',
    condominium_id: 'c1',
    condominium_name: 'RESIDENCIAL BIARRITZ',
    balancete_digital: false,
    received_at: null,
    digital_prepared_at: '2026-09-25T17:55:29.273Z',
    competencia: '08/2026',
    volumes: 1,
    observations: null,
    status: 'recebido',
    sent_at: null,
    protocolo_id: null,
    created_at: null,
    updated_at: null,
    ...overrides,
  }
}

function renderForm(props: { balancete?: Balancete | null } = {}) {
  render(
    <BalanceteForm
      open
      onOpenChange={vi.fn()}
      condominiums={condominiums}
      onSubmit={vi.fn()}
      {...props}
    />
  )
  return screen.getByLabelText(/Data de Recebimento/) as HTMLInputElement
}

describe('BalanceteForm - data de recebimento', () => {
  beforeEach(() => {
    // 22:30 em Brasília do dia 05/10; em UTC já é dia 06 (toISOString daria a data errada).
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-06T01:30:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('traz a data de hoje ao abrir um balancete aguardando fisico', () => {
    const input = renderForm({ balancete: balancete({ received_at: null }) })

    expect(input.value).toBe('2026-10-05')
  })

  it('avisa que salvar registra o recebimento e como manter aguardando', () => {
    renderForm({ balancete: balancete({ received_at: null }) })

    expect(screen.getByText(/ao salvar.*recebido/i)).toBeInTheDocument()
  })

  it('mantem a data ja registrada de um balancete recebido, sem aviso', () => {
    const input = renderForm({ balancete: balancete({ received_at: '2026-09-30' }) })

    expect(input.value).toBe('2026-09-30')
    expect(screen.queryByText(/ao salvar.*recebido/i)).not.toBeInTheDocument()
  })

  it('usa a data de hoje em Brasilia ao cadastrar um novo balancete', () => {
    const input = renderForm()

    expect(input.value).toBe('2026-10-05')
  })
})
