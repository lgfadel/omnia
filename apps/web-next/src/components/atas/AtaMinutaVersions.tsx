"use client"

import { History, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { describeMinutaUsage } from '@/lib/ataMinuta'
import type { AtaMinutaVersion, AtaMinutaVersionOrigin } from '@/data/types'

interface AtaMinutaVersionsProps {
  versions: AtaMinutaVersion[]
  currentContent: string
  disabled?: boolean
  onRestore: (version: AtaMinutaVersion) => void
}

const originLabels: Record<AtaMinutaVersionOrigin, string> = {
  generation: 'Geração inicial',
  chat: 'Correção via chat',
  manual: 'Edição manual',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export function AtaMinutaVersions({ versions, currentContent, disabled, onRestore }: AtaMinutaVersionsProps) {
  if (versions.length === 0) return null

  const ordered = [...versions].sort((a, b) => b.sequence - a.sequence)

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground"><History className="h-4 w-4" />Histórico de versões</p>
      <ul className="space-y-1.5">
        {ordered.map((version) => {
          const isCurrent = version.content === currentContent
          return (
            <li key={version.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
              <div>
                <p className="font-medium">
                  Versão {version.sequence + 1} — {originLabels[version.origin]}
                  {version.model && <span className="font-normal text-muted-foreground"> · {version.model}</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(version.createdAt)}
                  {describeMinutaUsage(version.usage) && <span> · {describeMinutaUsage(version.usage)}</span>}
                </p>
              </div>
              {isCurrent ? (
                <span className="shrink-0 text-xs text-muted-foreground">Atual</span>
              ) : (
                <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onRestore(version)}>
                  <RotateCcw className="mr-2 h-3.5 w-3.5" />
                  Restaurar
                </Button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
