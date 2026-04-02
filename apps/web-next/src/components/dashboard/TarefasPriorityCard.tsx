"use client";

import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { generateUserColor, getUserInitials } from '@/lib/userColors'

type TaskPriorityKey = 'URGENTE' | 'ALTA' | 'NORMAL' | 'BAIXA'

interface TarefaPriorityItem {
  id: string
  title: string
  priority: string
  responsibleName: string
  responsibleColor?: string
  dueDate?: string
  isOverdue: boolean
  overdueDays?: number
}

interface TarefasPriorityCardProps {
  items: TarefaPriorityItem[]
}

const PRIORITY_META: Array<{ key: TaskPriorityKey; label: string; color: string }> = [
  { key: 'URGENTE', label: 'Urgente', color: 'hsl(var(--critical))' },
  { key: 'ALTA', label: 'Alta', color: 'hsl(var(--attention))' },
  { key: 'NORMAL', label: 'Normal', color: 'hsl(var(--recent))' },
  { key: 'BAIXA', label: 'Baixa', color: 'hsl(var(--muted-foreground))' },
]

interface TooltipProps {
  active?: boolean
  payload?: Array<{
    payload: { name: string; value: number; color: string; totalValue: number }
  }>
}

function formatDueDate(date?: string) {
  if (!date) return 'Sem vencimento'
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return 'Sem vencimento'
  return format(parsed, 'dd/MM/yyyy', { locale: ptBR })
}

function getDueLabel(item: TarefaPriorityItem) {
  if (!item.dueDate) return 'Sem vencimento'
  if (item.isOverdue) return `Atrasada ${item.overdueDays ?? 0} dias`
  return 'No prazo'
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
        {data.value} tarefas • {percentage}%
      </p>
    </div>
  )
}

export function TarefasPriorityCard({ items }: TarefasPriorityCardProps) {
  const router = useRouter()
  const [selectedPriority, setSelectedPriority] = useState<TaskPriorityKey | null>(null)

  const orderedRows = useMemo(() => {
    const counts = new Map<TaskPriorityKey, number>(
      PRIORITY_META.map((item) => [item.key, 0]),
    )

    items.forEach((item) => {
      const key = (item.priority || 'NORMAL').toUpperCase() as TaskPriorityKey
      if (counts.has(key)) {
        counts.set(key, (counts.get(key) || 0) + 1)
      }
    })

    return PRIORITY_META.map((item) => ({
      ...item,
      value: counts.get(item.key) || 0,
    }))
  }, [items])

  const pieData = orderedRows.filter((item) => item.value > 0)
  const totalValue = items.length || 0
  const enhancedPieData = pieData.map((item) => ({ ...item, name: item.label, totalValue }))

  const modalItems = useMemo(() => {
    if (!selectedPriority) return []

    return items
      .filter((item) => (item.priority || 'NORMAL').toUpperCase() === selectedPriority)
      .sort((a, b) => {
        const aTime = a.dueDate ? new Date(a.dueDate).getTime() : -Infinity
        const bTime = b.dueDate ? new Date(b.dueDate).getTime() : -Infinity
        return bTime - aTime
      })
  }, [items, selectedPriority])

  const selectedPriorityMeta = selectedPriority
    ? PRIORITY_META.find((item) => item.key === selectedPriority) || null
    : null

  return (
    <>
      <Card className="rounded-[28px] border-white/70 bg-white/85 p-5 shadow-[0_18px_60px_-40px_rgba(15,23,42,0.38)]">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-foreground">Prioridade das tarefas ativas</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {totalValue ? `${totalValue} tarefas abertas distribuídas por prioridade.` : 'Sem tarefas ativas para exibir.'}
            </p>
          </div>
          <div className="rounded-full bg-[hsl(var(--surface-tint))] px-3 py-1 text-xs font-medium text-muted-foreground">
            Total {totalValue}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={enhancedPieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={104}
                  innerRadius={66}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                >
                  {enhancedPieData.map((entry, index) => (
                    <Cell
                      key={`${entry.label}-${index}`}
                      fill={entry.color}
                      className="cursor-pointer"
                      onClick={() => setSelectedPriority(entry.key)}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-[minmax(0,1fr)_56px] gap-3 px-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <span>Prioridade</span>
              <span className="text-right">Total</span>
            </div>

            {orderedRows.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => item.value > 0 && setSelectedPriority(item.key)}
                className="grid w-full grid-cols-[minmax(0,1fr)_56px] items-center gap-3 rounded-2xl bg-[hsl(var(--surface-tint))] px-4 py-3 text-left transition hover:bg-[hsl(var(--surface-tint))]/80 disabled:cursor-default disabled:hover:bg-[hsl(var(--surface-tint))]"
                disabled={!item.value}
              >
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm font-medium text-foreground">{item.label}</span>
                </div>
                <span className="text-right text-sm font-medium text-muted-foreground">{item.value}</span>
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Dialog open={Boolean(selectedPriority)} onOpenChange={(open) => !open && setSelectedPriority(null)}>
        <DialogContent className="max-w-3xl rounded-[28px] border-white bg-white p-0">
          <DialogHeader className="border-b border-border/60 px-6 py-5">
            <DialogTitle className="sr-only">
              Tarefas na prioridade {selectedPriorityMeta?.label}
            </DialogTitle>
            <div className="flex flex-wrap items-center gap-3">
              {selectedPriorityMeta ? (
                <span
                  className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]"
                  style={{
                    backgroundColor: `${selectedPriorityMeta.color}22`,
                    color: selectedPriorityMeta.color,
                  }}
                >
                  {selectedPriorityMeta.label}
                </span>
              ) : null}
            </div>
            <DialogDescription>{modalItems.length} tarefas encontradas nesta prioridade.</DialogDescription>
          </DialogHeader>

          <div className="max-h-[70vh] space-y-3 overflow-y-auto px-6 py-5">
            {modalItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => router.push(`/tarefas/${item.id}`)}
                className="grid w-full grid-cols-[minmax(0,1fr)_110px_36px_152px] items-center gap-4 rounded-2xl bg-slate-100 px-4 py-3 text-left transition hover:bg-slate-200/80"
              >
                <p className="truncate text-sm font-semibold text-foreground">{item.title}</p>
                <span className="shrink-0 text-sm text-muted-foreground">{formatDueDate(item.dueDate)}</span>
                <div className="flex justify-center">
                  {item.responsibleName && item.responsibleName !== 'Não atribuído' ? (
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
                    item.isOverdue
                      ? 'w-[152px] justify-self-end whitespace-nowrap rounded-full bg-[hsl(var(--critical)/0.12)] px-3 py-1 text-center text-xs font-semibold text-[hsl(var(--critical))]'
                      : item.dueDate
                        ? 'w-[152px] justify-self-end whitespace-nowrap rounded-full bg-[hsl(var(--healthy)/0.14)] px-3 py-1 text-center text-xs font-semibold text-[hsl(var(--healthy))]'
                        : 'w-[152px] justify-self-end whitespace-nowrap rounded-full bg-slate-200 px-3 py-1 text-center text-xs font-semibold text-slate-600'
                  }
                >
                  {getDueLabel(item)}
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
