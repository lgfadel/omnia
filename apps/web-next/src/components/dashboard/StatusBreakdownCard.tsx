import { Card } from '@/components/ui/card'

interface StatusBreakdownCardProps {
  title: string
  totalLabel: string
  totalValue: number
  items: Array<{ name: string; value: number; color: string }>
  emptyLabel: string
}

export function StatusBreakdownCard({
  title,
  totalLabel,
  totalValue,
  items,
  emptyLabel,
}: StatusBreakdownCardProps) {
  return (
    <Card className="rounded-[30px] border-white/70 bg-white/86 p-6 shadow-[0_24px_70px_-46px_rgba(15,23,42,0.42)]">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/70">
          {title}
        </p>
        <h3 className="text-3xl font-semibold tracking-tight text-foreground">{totalValue}</h3>
        <p className="text-sm text-muted-foreground">{totalLabel}</p>
      </div>

      <div className="mt-6 space-y-3">
        {items.length ? (
          items.map((item) => (
            <div
              key={item.name}
              className="flex items-center justify-between rounded-2xl bg-[hsl(var(--surface-tint))] px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-sm font-medium text-foreground">{item.name}</span>
              </div>
              <span className="text-sm text-muted-foreground">{item.value}</span>
            </div>
          ))
        ) : (
          <div className="rounded-2xl bg-[hsl(var(--surface-tint))] px-4 py-6 text-sm text-muted-foreground">
            {emptyLabel}
          </div>
        )}
      </div>
    </Card>
  )
}
