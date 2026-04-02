import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Activity, Sparkles } from 'lucide-react'
import { InsightBanner } from './InsightBanner'

interface DashboardHeroProps {
  lastUpdated: Date | null
  highlights: Array<{
    id: string
    label: string
    tone: 'critical' | 'attention' | 'healthy' | 'recent'
  }>
}

export function DashboardHero({ lastUpdated, highlights }: DashboardHeroProps) {
  const updatedLabel = lastUpdated
    ? format(lastUpdated, "dd 'de' MMMM, HH:mm", { locale: ptBR })
    : 'Aguardando sincronização'

  return (
    <section className="dashboard-hero relative overflow-hidden rounded-[36px] border border-white/60 bg-[linear-gradient(135deg,rgba(255,248,237,0.98),rgba(255,255,255,0.9)_42%,rgba(219,234,254,0.78)_100%)] px-6 py-8 shadow-[0_30px_100px_-48px_rgba(15,23,42,0.48)] md:px-8 md:py-10">
      <div aria-hidden className="absolute -left-12 top-8 h-40 w-40 rounded-full bg-[hsl(var(--attention)/0.2)] blur-3xl" />
      <div aria-hidden className="absolute right-0 top-0 h-48 w-48 rounded-full bg-[hsl(var(--recent)/0.2)] blur-3xl" />
      <div aria-hidden className="absolute bottom-0 right-24 h-36 w-36 rounded-full bg-[hsl(var(--healthy)/0.18)] blur-3xl" />

      <div className="relative space-y-7">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/65 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-primary/80 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              Central executiva
            </div>
            <div className="space-y-3">
              <h1 className="max-w-2xl text-4xl font-semibold tracking-[-0.04em] text-slate-900 md:text-5xl">
                Operação inteira em uma leitura só.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-600 md:text-lg">
                O dashboard consolida backlog atual, atividade recente e sinais críticos de atas,
                tarefas, admissões, rescisões e balancetes.
              </p>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/70 bg-white/78 px-5 py-4 shadow-sm backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-[hsl(var(--recent)/0.12)] p-3 text-[hsl(var(--recent))]">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Última atualização
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">{updatedLabel}</p>
              </div>
            </div>
          </div>
        </div>

        <InsightBanner items={highlights} />
      </div>
    </section>
  )
}
