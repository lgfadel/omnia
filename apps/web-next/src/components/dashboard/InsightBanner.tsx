import { cn } from '@/lib/utils'

interface InsightBannerProps {
  items: Array<{
    id: string
    label: string
    tone: 'critical' | 'attention' | 'healthy' | 'recent'
  }>
}

const toneClasses = {
  critical: 'border-[hsl(var(--critical)/0.2)] bg-[hsl(var(--critical)/0.1)] text-[hsl(var(--critical-foreground))]',
  attention: 'border-[hsl(var(--attention)/0.22)] bg-[hsl(var(--attention)/0.16)] text-[hsl(var(--attention-foreground))]',
  healthy: 'border-[hsl(var(--healthy)/0.2)] bg-[hsl(var(--healthy)/0.14)] text-[hsl(var(--healthy-foreground))]',
  recent: 'border-[hsl(var(--recent)/0.18)] bg-[hsl(var(--recent)/0.12)] text-[hsl(var(--recent-foreground))]',
}

export function InsightBanner({ items }: InsightBannerProps) {
  if (!items.length) {
    return (
      <div className="rounded-[28px] border border-border/60 bg-white/75 px-5 py-4 text-sm text-muted-foreground shadow-[0_20px_60px_-40px_rgba(15,23,42,0.3)] backdrop-blur">
        Nenhum alerta crítico no momento. O painel continua acompanhando a operação em tempo real.
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-3">
      {items.map((item) => (
        <div
          key={item.id}
          className={cn(
            'rounded-full border px-4 py-2 text-sm font-medium shadow-sm',
            toneClasses[item.tone],
          )}
        >
          {item.label}
        </div>
      ))}
    </div>
  )
}
