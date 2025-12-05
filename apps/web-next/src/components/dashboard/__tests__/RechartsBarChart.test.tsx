import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import RechartsBarChart from '../RechartsBarChart'

// Mock do Recharts para evitar problemas com SVG em testes
vi.mock('recharts', () => ({
  BarChart: ({ children, ...props }: any) => (
    <div data-testid="bar-chart" {...props}>
      {children}
    </div>
  ),
  Bar: (props: any) => <div data-testid="bar" {...props} />,
  XAxis: (props: any) => <div data-testid="x-axis" {...props} />,
  YAxis: (props: any) => <div data-testid="y-axis" {...props} />,
  CartesianGrid: (props: any) => <div data-testid="cartesian-grid" {...props} />,
  Tooltip: (props: any) => <div data-testid="tooltip" {...props} />,
  ResponsiveContainer: ({ children, ...props }: any) => (
    <div data-testid="responsive-container" {...props}>
      {children}
    </div>
  ),
}))

const mockData = [
  { category: 'Janeiro', value: 10 },
  { category: 'Fevereiro', value: 15 },
  { category: 'Março', value: 8 },
  { category: 'Abril', value: 20 },
]

describe('RechartsBarChart', () => {
  it('deve renderizar o título', () => {
    render(
      <RechartsBarChart
        data={mockData}
        title="Vendas por Mês"
      />
    )

    expect(screen.getByText('Vendas por Mês')).toBeInTheDocument()
  })

  it('deve renderizar o container responsivo', () => {
    render(
      <RechartsBarChart
        data={mockData}
        title="Vendas por Mês"
      />
    )

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
  })

  it('deve renderizar o gráfico de barras', () => {
    render(
      <RechartsBarChart
        data={mockData}
        title="Vendas por Mês"
      />
    )

    expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
    expect(screen.getByTestId('bar')).toBeInTheDocument()
  })

  it('deve renderizar os eixos', () => {
    render(
      <RechartsBarChart
        data={mockData}
        title="Vendas por Mês"
      />
    )

    expect(screen.getByTestId('x-axis')).toBeInTheDocument()
    expect(screen.getByTestId('y-axis')).toBeInTheDocument()
  })

  it('deve renderizar grid e tooltip', () => {
    render(
      <RechartsBarChart
        data={mockData}
        title="Vendas por Mês"
      />
    )

    expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument()
    expect(screen.getByTestId('tooltip')).toBeInTheDocument()
  })

  it('deve aceitar altura customizada', () => {
    render(
      <RechartsBarChart
        data={mockData}
        title="Vendas por Mês"
        height={400}
      />
    )

    const container = screen.getByTestId('responsive-container')
    expect(container).toHaveAttribute('height', '100%')
  })

  it('deve aceitar cor customizada', () => {
    render(
      <RechartsBarChart
        data={mockData}
        title="Vendas por Mês"
        color="#ff0000"
      />
    )

    const bar = screen.getByTestId('bar')
    expect(bar).toHaveAttribute('fill', '#ff0000')
  })

  it('deve renderizar com dados vazios', () => {
    render(
      <RechartsBarChart
        data={[]}
        title="Vendas por Mês"
      />
    )

    expect(screen.getByText('Vendas por Mês')).toBeInTheDocument()
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
  })
})