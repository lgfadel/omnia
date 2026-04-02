import { LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'

interface ModuleHealthCardProps {
  title: string
  subtitle: string
  value: number | string
  icon: LucideIcon
  accent: string
  details: string[]
}

export function ModuleHealthCard({
  title,
  subtitle,
  value,
  icon: Icon,
  accent,
  details,
}: ModuleHealthCardProps) {
  return (
    <Card className="group relative overflow-hidden rounded-[30px] border-white/70 bg-white/82 p-6 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.45)] backdrop-blur">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-1.5"
        style={{ background: accent }}
      />
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            {title}
          </p>
          <div className="flex items-end gap-3">
            <span className="text-4xl font-semibold tracking-tight text-foreground">{value}</span>
            <span className="pb-1 text-sm text-muted-foreground">{subtitle}</span>
          </div>
        </div>
        <div
          className="rounded-2xl p-3 text-white shadow-lg"
          style={{ background: accent }}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-6 space-y-2">
        {details.map((detail) => (
          <div
            key={detail}
            className="rounded-2xl bg-[hsl(var(--surface-tint))] px-3 py-2 text-sm text-muted-foreground"
          >
            {detail}
          </div>
        ))}
      </div>
    </Card>
  )
}
