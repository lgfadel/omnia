import { LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface ExecutiveKpiProps {
  title: string
  value: string | number
  description: string
  icon: LucideIcon
  tone?: 'default' | 'critical' | 'attention' | 'healthy' | 'recent'
}

const toneStyles = {
  default: {
    card: 'bg-white/85 border-white/70',
    badge: 'bg-primary/10 text-primary',
  },
  critical: {
    card: 'bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(254,226,226,0.92))] border-[hsl(var(--critical)/0.18)]',
    badge: 'bg-[hsl(var(--critical)/0.12)] text-[hsl(var(--critical))]',
  },
  attention: {
    card: 'bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(254,243,199,0.92))] border-[hsl(var(--attention)/0.22)]',
    badge: 'bg-[hsl(var(--attention)/0.16)] text-[hsl(var(--attention-foreground))]',
  },
  healthy: {
    card: 'bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(220,252,231,0.94))] border-[hsl(var(--healthy)/0.18)]',
    badge: 'bg-[hsl(var(--healthy)/0.14)] text-[hsl(var(--healthy))]',
  },
  recent: {
    card: 'bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(219,234,254,0.94))] border-[hsl(var(--recent)/0.18)]',
    badge: 'bg-[hsl(var(--recent)/0.12)] text-[hsl(var(--recent))]',
  },
}

export function ExecutiveKpi({
  title,
  value,
  description,
  icon: Icon,
  tone = 'default',
}: ExecutiveKpiProps) {
  const styles = toneStyles[tone]

  return (
    <Card className={cn('rounded-[28px] p-5 shadow-[0_22px_60px_-38px_rgba(15,23,42,0.45)] backdrop-blur', styles.card)}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            {title}
          </p>
          <div className="text-4xl font-semibold tracking-tight text-foreground">{value}</div>
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        <div className={cn('rounded-2xl p-3', styles.badge)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  )
}
