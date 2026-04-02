"use client";

import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
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
import { useTagsStore } from '@/stores/tags.store'

interface TarefaTagItem {
  id: string
  title: string
  tags: string[]
  responsibleName: string
  responsibleColor?: string
  dueDate?: string
  isOverdue: boolean
  overdueDays?: number
}

interface TarefasTagsCloudProps {
  items: TarefaTagItem[]
}

const CLOUD_COLORS = [
  '#0f172a',
  '#f43f5e',
  '#059669',
  '#f59e0b',
  '#0284c7',
]

const CLOUD_PADDING = 18

interface PositionedCloudItem {
  tag: string
  value: number
  color: string
  fontSize: number
  left: number
  top: number
}

function estimateWordWidth(tag: string, fontSize: number) {
  return Math.max(tag.length * fontSize * 0.56, fontSize * 2.4)
}

function overlaps(
  left: number,
  top: number,
  width: number,
  height: number,
  placed: PositionedCloudItem[],
) {
  return placed.some((item) => {
    const itemWidth = estimateWordWidth(item.tag, item.fontSize)
    const itemHeight = item.fontSize * 1.1

    return !(
      left + width < item.left - itemWidth / 2 ||
      left > item.left + itemWidth / 2 ||
      top + height < item.top - itemHeight / 2 ||
      top > item.top + itemHeight / 2
    )
  })
}

function buildPositionedCloudItems(
  items: Array<{ tag: string; value: number; color: string; fontSize: number }>,
  dimensions: { width: number; height: number },
) {
  const placed: PositionedCloudItem[] = []
  const centerX = dimensions.width / 2
  const centerY = dimensions.height / 2
  const radiusX = dimensions.width * 0.36
  const radiusY = dimensions.height * 0.28

  items.forEach((item, index) => {
    let fontSize = item.fontSize
    let placedItem: PositionedCloudItem | null = null

    for (let shrink = 0; shrink < 5 && !placedItem; shrink += 1) {
      const currentFontSize = Math.max(fontSize - shrink * 2, 12)
      const width = estimateWordWidth(item.tag, currentFontSize)
      const height = currentFontSize * 1.1

      for (let step = 0; step < 2200; step += 1) {
        const theta = step * 0.38 + index * 0.6
        const progress = step / 2200
        const radialFactor = Math.sqrt(progress)
        const left = centerX + Math.cos(theta) * radiusX * radialFactor
        const top = centerY + Math.sin(theta) * radiusY * radialFactor

        if (
          left - width / 2 < CLOUD_PADDING ||
          left + width / 2 > dimensions.width - CLOUD_PADDING ||
          top - height / 2 < CLOUD_PADDING ||
          top + height / 2 > dimensions.height - CLOUD_PADDING
        ) {
          continue
        }

        if (
          !overlaps(
            left - width / 2,
            top - height / 2,
            width,
            height,
            placed,
          )
        ) {
          placedItem = {
            ...item,
            fontSize: currentFontSize,
            left,
            top,
          }
          break
        }
      }
    }

    if (placedItem) {
      placed.push(placedItem)
    }
  })

  return placed
}

function formatDueDate(date?: string) {
  if (!date) return 'Sem vencimento'
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return 'Sem vencimento'
  return format(parsed, 'dd/MM/yyyy', { locale: ptBR })
}

function getDueLabel(item: TarefaTagItem) {
  if (!item.dueDate) return 'Sem vencimento'
  if (item.isOverdue) return `Atrasada ${item.overdueDays ?? 0} dias`
  return 'No prazo'
}

export function TarefasTagsCloud({ items }: TarefasTagsCloudProps) {
  const router = useRouter()
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const { tags, loadTags } = useTagsStore()

  const cloudItems = useMemo(() => {
    const counts = new Map<string, number>()
    const tagColorMap = new Map(tags.map((tag) => [tag.name, tag.color]))

    items.forEach((item) => {
      item.tags
        .map((tag) => tag.trim())
        .filter(Boolean)
        .forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1))
    })

    const values = Array.from(counts.values())
    const minValue = values.length ? Math.min(...values) : 0
    const maxValue = values.length ? Math.max(...values) : 0
    const itemCount = counts.size
    const maxFontSize = itemCount > 40 ? 30 : itemCount > 24 ? 38 : itemCount > 14 ? 46 : 56
    const minFontSize = itemCount > 40 ? 11 : itemCount > 24 ? 13 : 16

    return Array.from(counts.entries())
      .map(([tag, value], index) => {
        const normalized = maxValue === minValue ? 0.5 : (value - minValue) / (maxValue - minValue)
        const fontSize = minFontSize + normalized * (maxFontSize - minFontSize)

        return {
          tag,
          value,
          color: tagColorMap.get(tag) || CLOUD_COLORS[index % CLOUD_COLORS.length],
          fontSize: Math.round(fontSize),
        }
      })
      .sort((a, b) => b.value - a.value || a.tag.localeCompare(b.tag))
  }, [items, tags])

  const cloudDimensions = useMemo(() => {
    const extraTags = Math.max(cloudItems.length - 10, 0)

    return {
      width: 980 + Math.min(extraTags * 18, 240),
      height: 280 + Math.min(extraTags * 11, 140),
    }
  }, [cloudItems.length])

  const positionedCloudItems = useMemo(
    () => buildPositionedCloudItems(cloudItems, cloudDimensions),
    [cloudItems, cloudDimensions],
  )

  const modalItems = useMemo(() => {
    if (!selectedTag) return []

    return items
      .filter((item) => item.tags.some((tag) => tag.trim() === selectedTag))
      .sort((a, b) => {
        const aTime = a.dueDate ? new Date(a.dueDate).getTime() : -Infinity
        const bTime = b.dueDate ? new Date(b.dueDate).getTime() : -Infinity
        return bTime - aTime
      })
  }, [items, selectedTag])

  const selectedTagColor = useMemo(
    () => tags.find((tag) => tag.name === selectedTag)?.color,
    [selectedTag, tags],
  )

  useEffect(() => {
    if (!tags.length) {
      loadTags()
    }
  }, [loadTags, tags.length])

  return (
    <>
      <Card className="rounded-[28px] border-white/70 bg-white/85 p-5 shadow-[0_18px_60px_-40px_rgba(15,23,42,0.38)]">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-foreground">Nuvem de tags das tarefas</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Temas mais recorrentes nas tarefas abertas, ponderados pela frequência das tags.
            </p>
          </div>
          <div className="rounded-full bg-[hsl(var(--surface-tint))] px-3 py-1 text-xs font-medium text-muted-foreground">
            {cloudItems.length} tags
          </div>
        </div>

        {cloudItems.length ? (
          <div className="overflow-hidden rounded-[24px] bg-[linear-gradient(180deg,rgba(248,250,252,0.86),rgba(255,255,255,0.98))] px-3 py-3">
            <div className="mx-auto w-full max-w-[980px]">
              <div
                className="relative mx-auto w-full"
                style={{ height: `${cloudDimensions.height}px` }}
              >
                {positionedCloudItems.map((item) => {
                  return (
                    <button
                      key={item.tag}
                      type="button"
                      onClick={() => setSelectedTag(item.tag)}
                      title={`${item.tag} • ${item.value} tarefas`}
                      className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap leading-none transition hover:scale-[1.03]"
                      style={{
                        left: `${(item.left / cloudDimensions.width) * 100}%`,
                        top: `${(item.top / cloudDimensions.height) * 100}%`,
                        color: item.color,
                        fontSize: `${item.fontSize}px`,
                        fontWeight: item.value > 2 ? 700 : 600,
                        fontFamily: '"Instrument Sans", "Geist", sans-serif',
                      }}
                    >
                      {item.tag}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-[hsl(var(--surface-tint))] px-4 py-6 text-sm text-muted-foreground">
            Nenhuma tag encontrada nas tarefas abertas.
          </div>
        )}
      </Card>

      <Dialog open={Boolean(selectedTag)} onOpenChange={(open) => !open && setSelectedTag(null)}>
        <DialogContent className="max-w-3xl rounded-[28px] border-white bg-white p-0">
          <DialogHeader className="border-b border-border/60 px-6 py-5">
            <DialogTitle className="sr-only">Tarefas com a tag {selectedTag}</DialogTitle>
            <div className="flex flex-wrap items-center gap-3">
              {selectedTag ? (
                <span
                  className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]"
                  style={{
                    backgroundColor: selectedTagColor ? `${selectedTagColor}20` : 'hsl(var(--surface-tint))',
                    border: selectedTagColor ? `1px solid ${selectedTagColor}` : undefined,
                    color: selectedTagColor || 'hsl(var(--foreground))',
                  }}
                >
                  {selectedTag}
                </span>
              ) : null}
            </div>
            <DialogDescription>{modalItems.length} tarefas encontradas com esta tag.</DialogDescription>
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
