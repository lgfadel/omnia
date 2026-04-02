import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { Card } from '@/components/ui/card'

interface RechartsDonutChartProps {
  data: Array<{ name: string; value: number; color: string }>
  title: string
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{
    payload: { name: string; value: number; color: string; totalValue: number }
  }>
}

const CustomTooltip = ({ active, payload }: TooltipProps) => {
  if (!active || !payload?.length) return null

  const data = payload[0].payload
  const percentage = ((data.value / data.totalValue) * 100).toFixed(1)

  return (
    <div className="rounded-2xl border border-border/70 bg-white px-3 py-2 text-sm shadow-xl">
      <p className="font-semibold" style={{ color: data.color }}>
        {data.name}
      </p>
      <p className="mt-1 text-muted-foreground">
        {data.value} itens • {percentage}%
      </p>
    </div>
  )
}

export function RechartsDonutChart({ data, title }: RechartsDonutChartProps) {
  const totalValue = data.reduce((sum, item) => sum + item.value, 0) || 1
  const enhancedData = data.map((item) => ({ ...item, totalValue }))

  return (
    <Card className="rounded-[28px] border-white/70 bg-white/85 p-5 shadow-[0_18px_60px_-40px_rgba(15,23,42,0.38)]">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold tracking-tight text-foreground">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.length ? `${totalValue} registros distribuídos neste bloco.` : 'Sem registros para exibir.'}
          </p>
        </div>
        <div className="rounded-full bg-[hsl(var(--surface-tint))] px-3 py-1 text-xs font-medium text-muted-foreground">
          Total {totalValue}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_180px] lg:items-center">
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={enhancedData}
                cx="50%"
                cy="50%"
                outerRadius={104}
                innerRadius={66}
                paddingAngle={3}
                dataKey="value"
                nameKey="name"
              >
                {enhancedData.map((entry, index) => (
                  <Cell key={`${entry.name}-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-3">
          {enhancedData.length ? (
            enhancedData.map((item) => (
              <div key={item.name} className="flex items-center justify-between gap-4 rounded-2xl bg-[hsl(var(--surface-tint))] px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm text-foreground">{item.name}</span>
                </div>
                <span className="text-sm font-medium text-muted-foreground">{item.value}</span>
              </div>
            ))
          ) : (
            <div className="rounded-2xl bg-[hsl(var(--surface-tint))] px-4 py-6 text-sm text-muted-foreground">
              Nenhum dado disponível.
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
