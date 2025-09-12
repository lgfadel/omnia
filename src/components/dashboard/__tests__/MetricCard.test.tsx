import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Heart } from 'lucide-react'
import { MetricCard, AtasMetricCard, TarefasMetricCard, TaxaConclusaoCard } from '../MetricCard'

describe('MetricCard', () => {
  it('deve renderizar o título e valor', () => {
    render(
      <MetricCard
        title="Total de Tickets"
        value={150}
      />
    )

    expect(screen.getByText('Total de Tickets')).toBeInTheDocument()
    expect(screen.getByText('150')).toBeInTheDocument()
  })

  it('deve renderizar com ícone', () => {
    render(
      <MetricCard
        title="Total de Tickets"
        value={150}
        icon={Heart}
        iconColor="text-red-500"
      />
    )

    expect(screen.getByText('Total de Tickets')).toBeInTheDocument()
    // O ícone é renderizado mas não tem texto específico para testar
  })

  it('deve renderizar subtítulo quando fornecido', () => {
    render(
      <MetricCard
        title="Total de Tickets"
        value={150}
        subtitle="Este mês"
      />
    )

    expect(screen.getByText('Este mês')).toBeInTheDocument()
  })

  it('deve renderizar trend quando fornecido', () => {
    render(
      <MetricCard
        title="Total de Tickets"
        value={150}
        trend={{
          value: 12,
          label: 'vs mês anterior',
          isPositive: true
        }}
      />
    )

    expect(screen.getByText('+12% vs mês anterior')).toBeInTheDocument()
  })

  it('deve chamar onClick quando clicado', () => {
    const handleClick = vi.fn()
    
    render(
      <MetricCard
        title="Total de Tickets"
        value={150}
        onClick={handleClick}
      />
    )

    fireEvent.click(screen.getByText('Total de Tickets'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('deve formatar números grandes corretamente', () => {
    render(
      <MetricCard
        title="Total de Tickets"
        value={1500}
      />
    )

    expect(screen.getByText('1.500')).toBeInTheDocument()
  })
})

describe('AtasMetricCard', () => {
  it('deve renderizar com total', () => {
    render(
      <AtasMetricCard
        title="Atas Pendentes"
        value={5}
        total={20}
      />
    )

    expect(screen.getByText('Atas Pendentes')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('25% do total (20)')).toBeInTheDocument()
  })
})

describe('TarefasMetricCard', () => {
  it('deve renderizar com total', () => {
    render(
      <TarefasMetricCard
        title="Tarefas Concluídas"
        value={15}
        total={30}
      />
    )

    expect(screen.getByText('Tarefas Concluídas')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()
    expect(screen.getByText('50% do total (30)')).toBeInTheDocument()
  })
})

describe('TaxaConclusaoCard', () => {
  it('deve renderizar taxa de conclusão', () => {
    render(
      <TaxaConclusaoCard
        taxa={75.5}
      />
    )

    expect(screen.getByText('Taxa de Conclusão')).toBeInTheDocument()
    expect(screen.getByText('75.5%')).toBeInTheDocument()
  })

  it('deve renderizar com label customizado', () => {
    render(
      <TaxaConclusaoCard
        taxa={85}
        label="Taxa de Sucesso"
      />
    )

    expect(screen.getByText('Taxa de Sucesso')).toBeInTheDocument()
    expect(screen.getByText('85.0%')).toBeInTheDocument()
  })
})