interface DashboardSectionHeaderProps {
  eyebrow?: string
  title: string
  description?: string
}

export function DashboardSectionHeader({
  eyebrow,
  title,
  description,
}: DashboardSectionHeaderProps) {
  return (
    <div className="space-y-2">
      {eyebrow ? (
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-primary/70">
          {eyebrow}
        </p>
      ) : null}
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
        {description ? (
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </div>
  )
}
