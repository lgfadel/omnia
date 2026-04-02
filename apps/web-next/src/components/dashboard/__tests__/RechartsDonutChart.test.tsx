import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RechartsDonutChart } from '../RechartsDonutChart'

vi.mock('recharts', () => ({
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({ children }: any) => <div data-testid="pie">{children}</div>,
  Cell: (props: any) => <div data-testid="cell" {...props} />,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  Tooltip: () => <div data-testid="tooltip" />,
}))

describe('RechartsDonutChart', () => {
  it('renderiza o título recebido por props', () => {
    render(
      <RechartsDonutChart
        title="Saúde dos balancetes"
        data={[{ name: 'Em dia', value: 3, color: '#00aa00' }]}
      />,
    )

    expect(screen.getByText('Saúde dos balancetes')).toBeInTheDocument()
    expect(screen.getByText(/3 registros distribuídos/i)).toBeInTheDocument()
  })

  it('renderiza estado vazio de forma explícita', () => {
    render(<RechartsDonutChart title="Status" data={[]} />)

    expect(screen.getByText('Nenhum dado disponível.')).toBeInTheDocument()
  })
})
