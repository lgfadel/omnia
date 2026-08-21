"use client"

import { useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { CaseSensitive, ChevronDown, ChevronUp, ReplaceAll, Search, Undo2 } from 'lucide-react'

interface AtaTranscriptionEditorProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  ariaLabel?: string
  textareaClassName?: string
}

// Percorre o texto com indexOf em vez de RegExp: o que se digita na busca é
// conteúdo de ata, não padrão — "R$ 1.200,00" ou "(art. 5º)" viraria uma
// expressão inválida ou, pior, um casamento silenciosamente errado.
function findMatches(text: string, term: string, caseSensitive: boolean): number[] {
  if (!term) return []
  const haystack = caseSensitive ? text : text.toLowerCase()
  const needle = caseSensitive ? term : term.toLowerCase()
  const matches: number[] = []
  for (let index = haystack.indexOf(needle); index !== -1; index = haystack.indexOf(needle, index + needle.length)) {
    matches.push(index)
  }
  return matches
}

export function AtaTranscriptionEditor({ value, onChange, disabled, ariaLabel = 'Texto da transcrição', textareaClassName = 'min-h-72 font-mono text-sm leading-6' }: AtaTranscriptionEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [term, setTerm] = useState('')
  const [replacement, setReplacement] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [current, setCurrent] = useState(0)
  // Substituir tudo pode reescrever centenas de pontos de uma assembleia inteira,
  // e o Ctrl+Z do navegador não alcança uma alteração feita por código.
  const [undoState, setUndoState] = useState<{ text: string; count: number } | null>(null)

  const matches = useMemo(() => findMatches(value, term, caseSensitive), [value, term, caseSensitive])
  const activeIndex = matches.length === 0 ? 0 : Math.min(current, matches.length - 1)

  const selectMatch = (index: number) => {
    if (matches.length === 0) return
    const nextIndex = (index + matches.length) % matches.length
    setCurrent(nextIndex)
    const start = matches[nextIndex]
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.focus()
    textarea.setSelectionRange(start, start + term.length)
  }

  const applyChange = (next: string, count: number) => {
    setUndoState({ text: value, count })
    onChange(next)
  }

  const replaceCurrent = () => {
    if (matches.length === 0) return
    const start = matches[activeIndex]
    applyChange(value.slice(0, start) + replacement + value.slice(start + term.length), 1)
  }

  const replaceAll = () => {
    if (matches.length === 0) return
    let result = ''
    let cursor = 0
    for (const start of matches) {
      result += value.slice(cursor, start) + replacement
      cursor = start + term.length
    }
    applyChange(result + value.slice(cursor), matches.length)
  }

  const undo = () => {
    if (!undoState) return
    onChange(undoState.text)
    setUndoState(null)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-2">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(event) => { setTerm(event.target.value); setCurrent(0) }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              selectMatch(event.shiftKey ? activeIndex - 1 : activeIndex + 1)
            }}
            placeholder="Localizar"
            aria-label="Localizar no texto"
            className="h-9 pl-8 pr-20"
            disabled={disabled}
          />
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs tabular-nums text-muted-foreground">
            {term ? (matches.length === 0 ? 'nenhuma' : `${activeIndex + 1} de ${matches.length}`) : ''}
          </span>
        </div>

        <Input
          value={replacement}
          onChange={(event) => setReplacement(event.target.value)}
          placeholder="Substituir por"
          aria-label="Substituir por"
          className="h-9 min-w-44 flex-1"
          disabled={disabled}
        />

        <Button
          type="button"
          variant={caseSensitive ? 'secondary' : 'ghost'}
          size="icon"
          className="h-9 w-9 shrink-0"
          aria-pressed={caseSensitive}
          aria-label="Diferenciar maiúsculas de minúsculas"
          title="Diferenciar maiúsculas de minúsculas"
          disabled={disabled}
          onClick={() => setCaseSensitive((previous) => !previous)}
        >
          <CaseSensitive className="h-4 w-4" />
        </Button>

        <div className="flex shrink-0 items-center">
          <Button
            type="button" variant="ghost" size="icon" className="h-9 w-9"
            aria-label="Ocorrência anterior" title="Ocorrência anterior"
            disabled={disabled || matches.length === 0}
            onClick={() => selectMatch(activeIndex - 1)}
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            type="button" variant="ghost" size="icon" className="h-9 w-9"
            aria-label="Próxima ocorrência" title="Próxima ocorrência"
            disabled={disabled || matches.length === 0}
            onClick={() => selectMatch(activeIndex + 1)}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>

        <Button
          type="button" variant="outline" size="sm" className="h-9 shrink-0"
          disabled={disabled || matches.length === 0}
          onClick={replaceCurrent}
        >
          Substituir
        </Button>
        <Button
          type="button" variant="outline" size="sm" className="h-9 shrink-0"
          disabled={disabled || matches.length === 0}
          onClick={replaceAll}
        >
          <ReplaceAll className="mr-2 h-4 w-4" />
          Tudo
        </Button>
      </div>

      {undoState && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-violet-200 bg-violet-50/60 px-3 py-2 text-sm dark:border-violet-900 dark:bg-violet-950/20">
          <span>
            {undoState.count === 1 ? '1 ocorrência substituída.' : `${undoState.count} ocorrências substituídas.`}
          </span>
          <Button type="button" variant="ghost" size="sm" className="h-8" onClick={undo}>
            <Undo2 className="mr-2 h-4 w-4" />
            Desfazer
          </Button>
        </div>
      )}

      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => { setUndoState(null); onChange(event.target.value) }}
        className={textareaClassName}
        aria-label={ariaLabel}
        disabled={disabled}
      />
    </div>
  )
}
