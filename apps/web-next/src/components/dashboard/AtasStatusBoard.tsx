import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { AlertTriangle, Filter } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { generateUserColor, getUserInitials } from '@/lib/userColors'

interface AtaOpenItem {
  id: string
  title: string
  code?: string
  statusName: string
  statusColor: string
  responsibleName: string
  responsibleColor?: string
  meetingDate?: string
  isOperationallyOverdue: boolean
  overdueDays?: number
}

interface AtasStatusBoardProps {
  totalOpen: number
  totalOperationallyOverdue: number
  items: AtaOpenItem[]
}

function formatMeetingDate(date?: string) {
  if (!date) return 'Sem data de assembleia'
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return 'Sem data de assembleia'
  return format(parsed, "dd/MM/yyyy", { locale: ptBR })
}

function getOverdueLabel(item: AtaOpenItem) {
  if (item.isOperationallyOverdue) {
    return `Atrasada ${item.overdueDays ?? 0} dias`
  }

  return 'No prazo'
}

export function AtasStatusBoard({
  totalOpen,
  totalOperationallyOverdue,
  items,
}: AtasStatusBoardProps) {
  const router = useRouter()
  const [responsibleFilter, setResponsibleFilter] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null)

  const responsibleOptions = useMemo(() => {
    return Array.from(
      new Set(items.map((item) => item.responsibleName).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b))
  }, [items])

  const filteredItems = useMemo(() => {
    if (responsibleFilter === 'all') return items
    return items.filter((item) => item.responsibleName === responsibleFilter)
  }, [items, responsibleFilter])

  const statusRows = useMemo(() => {
    const counts = new Map<string, { value: number; color: string }>()

    filteredItems.forEach((item) => {
      const current = counts.get(item.statusName)
      counts.set(item.statusName, {
        value: (current?.value || 0) + 1,
        color: item.statusColor,
      })
    })

    return Array.from(counts.entries())
      .map(([name, data]) => ({
        name,
        value: data.value,
        color: data.color,
      }))
      .sort((a, b) => b.value - a.value)
  }, [filteredItems])

  const filteredOpenCount = filteredItems.length
  const filteredOverdueCount = filteredItems.filter((item) => item.isOperationallyOverdue).length
  const selectedResponsibleLabel =
    responsibleFilter === 'all' ? 'Todos os responsáveis' : responsibleFilter
  const selectedStatusMeta = selectedStatus
    ? statusRows.find((item) => item.name === selectedStatus)
    : null
  const modalItems = selectedStatus
    ? filteredItems
        .filter((item) => item.statusName === selectedStatus)
        .sort((a, b) => {
          const aTime = a.meetingDate ? new Date(a.meetingDate).getTime() : -Infinity
          const bTime = b.meetingDate ? new Date(b.meetingDate).getTime() : -Infinity
          return bTime - aTime
        })
    : []

  return (
    <>
      <Card className="rounded-[30px] border-white/70 bg-white/86 p-6 shadow-[0_24px_70px_-46px_rgba(15,23,42,0.42)]">
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/70">ATAS</p>
              <div className="flex flex-wrap items-end gap-6">
                <div>
                  <div className="text-4xl font-semibold tracking-tight text-foreground">{filteredOpenCount}</div>
                  <p className="mt-1 text-sm text-muted-foreground">atas pendentes</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-[hsl(var(--critical))]">
                    <AlertTriangle className="h-5 w-5" />
                    {filteredOverdueCount}
                  </div>
                  <p className="mt-1 text-sm text-[hsl(var(--critical))]">após 15 dias da assembleia</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-muted-foreground sm:inline">{selectedResponsibleLabel}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 rounded-2xl border-white bg-[hsl(var(--surface-tint))] shadow-none"
                    aria-label="Filtrar atas por responsável"
                  >
                    <Filter className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 rounded-2xl border-white bg-white p-2">
                  <DropdownMenuLabel>Responsável</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup value={responsibleFilter} onValueChange={setResponsibleFilter}>
                    <DropdownMenuRadioItem value="all">Todos os responsáveis</DropdownMenuRadioItem>
                    {responsibleOptions.map((name) => (
                      <DropdownMenuRadioItem key={name} value={name}>
                        {name}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="space-y-3">
            {statusRows.length ? (
              statusRows.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => setSelectedStatus(item.name)}
                  className="flex w-full items-center justify-between rounded-2xl bg-[hsl(var(--surface-tint))] px-4 py-4 text-left transition hover:bg-[hsl(var(--surface-tint))]/80"
                >
                  <div className="flex items-center gap-4">
                    <span className="h-4 w-4 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-sm font-medium text-foreground">{item.name}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{item.value}</span>
                </button>
              ))
            ) : (
              <div className="rounded-2xl bg-[hsl(var(--surface-tint))] px-4 py-6 text-sm text-muted-foreground">
                Nenhuma ata pendente encontrada para este filtro.
              </div>
            )}
          </div>
        </div>
      </Card>

      <Dialog open={Boolean(selectedStatus)} onOpenChange={(open) => !open && setSelectedStatus(null)}>
        <DialogContent className="max-w-3xl rounded-[28px] border-white bg-white p-0">
          <DialogHeader className="border-b border-border/60 px-6 py-5">
            <DialogTitle className="sr-only">
              Atas no status {selectedStatus}
            </DialogTitle>
            <div className="flex flex-wrap items-center gap-3">
              {selectedStatusMeta ? (
                <span
                  className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]"
                  style={{
                    backgroundColor: `${selectedStatusMeta.color}22`,
                    color: selectedStatusMeta.color,
                  }}
                >
                  {selectedStatus}
                </span>
              ) : null}
            </div>
            <DialogDescription>
              {modalItems.length} atas encontradas para {selectedResponsibleLabel.toLowerCase()}.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[70vh] space-y-3 overflow-y-auto px-6 py-5">
            {modalItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => router.push(`/atas/${item.id}`)}
                className="grid w-full grid-cols-[minmax(0,1fr)_110px_36px_152px] items-center gap-4 rounded-2xl bg-slate-100 px-4 py-3 text-left transition hover:bg-slate-200/80"
              >
                <p className="truncate text-sm font-semibold text-foreground">
                  {item.code ? `${item.code} · ` : ''}{item.title}
                </p>
                <span className="shrink-0 text-sm text-muted-foreground">
                  {formatMeetingDate(item.meetingDate)}
                </span>
                <div className="flex justify-center">
                  {responsibleFilter === 'all' ? (
                    <Avatar className="h-6 w-6">
                      <AvatarFallback
                        className="text-[10px] font-medium text-white"
                        style={{
                          backgroundColor:
                            item.responsibleColor || generateUserColor(item.id, item.responsibleName),
                        }}
                      >
                        {getUserInitials(item.responsibleName)}
                      </AvatarFallback>
                    </Avatar>
                  ) : null}
                </div>
                <span
                  className={
                    item.isOperationallyOverdue
                      ? "w-[152px] justify-self-end whitespace-nowrap rounded-full bg-[hsl(var(--critical)/0.12)] px-3 py-1 text-center text-xs font-semibold text-[hsl(var(--critical))]"
                      : "w-[152px] justify-self-end whitespace-nowrap rounded-full bg-[hsl(var(--healthy)/0.14)] px-3 py-1 text-center text-xs font-semibold text-[hsl(var(--healthy))]"
                  }
                >
                  {getOverdueLabel(item)}
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
