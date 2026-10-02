"use client"

import { useId, useMemo, useRef, useState } from 'react'
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

export function AtaTranscriptionEditor({ value, onChange, disabled, ariaLabel = 'Texto da transcrição', textareaClassName = 'min-h-96 resize-y px-4 py-4 text-base leading-7 sm:px-5' }: AtaTranscriptionEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const searchToolsId = useId()
  const [searchToolsOpen, setSearchToolsOpen] = useState(false)
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
    if (disabled) return
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
    if (disabled || !undoState) return
    onChange(undoState.text)
    setUndoState(null)
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-9 gap-2 px-2 text-muted-foreground hover:text-foreground"
        aria-expanded={searchToolsOpen}
        aria-controls={searchToolsId}
        onClick={() => setSearchToolsOpen((previous) => !previous)}
      >
        <Search className="h-4 w-4" aria-hidden="true" />
        Localizar e substituir
        <ChevronDown className={`h-3.5 w-3.5 transition-transform motion-reduce:transition-none ${searchToolsOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
      </Button>

      {searchToolsOpen && (
        <div id={searchToolsId} role="group" aria-label="Ferramentas de localização e substituição" className="space-y-3 rounded-xl border bg-muted/20 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full min-w-0 sm:flex-1">
              <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
                className="h-9 pl-8"
              />
            </div>
            <div className="flex w-full items-center justify-between gap-2 sm:w-auto">
              <span role="status" className="min-w-16 text-xs tabular-nums text-muted-foreground">
                {term ? (matches.length === 0 ? 'nenhuma' : `${activeIndex + 1} de ${matches.length}`) : ''}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant={caseSensitive ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  aria-pressed={caseSensitive}
                  aria-label="Diferenciar maiúsculas de minúsculas"
                  title="Diferenciar maiúsculas de minúsculas"
                  onClick={() => setCaseSensitive((previous) => !previous)}
                >
                  <CaseSensitive className="h-4 w-4" aria-hidden="true" />
                </Button>

                <div className="flex shrink-0 items-center">
                  <Button
                    type="button" variant="ghost" size="icon" className="h-9 w-9"
                    aria-label="Ocorrência anterior" title="Ocorrência anterior"
                    disabled={matches.length === 0}
                    onClick={() => selectMatch(activeIndex - 1)}
                  >
                    <ChevronUp className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button" variant="ghost" size="icon" className="h-9 w-9"
                    aria-label="Próxima ocorrência" title="Próxima ocorrência"
                    disabled={matches.length === 0}
                    onClick={() => selectMatch(activeIndex + 1)}
                  >
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <Input
              value={replacement}
              onChange={(event) => setReplacement(event.target.value)}
              placeholder="Substituir por"
              aria-label="Substituir por"
              className="h-9 min-w-0"
              disabled={disabled}
            />

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button" variant="outline" size="sm" className="h-9 flex-1 sm:flex-none"
                disabled={disabled || matches.length === 0}
                onClick={replaceCurrent}
              >
                Substituir
              </Button>
              <Button
                type="button" variant="outline" size="sm" className="h-9 flex-1 sm:flex-none"
                disabled={disabled || matches.length === 0}
                onClick={replaceAll}
              >
                <ReplaceAll className="h-4 w-4" aria-hidden="true" />
                Tudo
              </Button>
            </div>
          </div>
        </div>
      )}

      {undoState && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-sm">
          <span>
            {undoState.count === 1 ? '1 ocorrência substituída.' : `${undoState.count} ocorrências substituídas.`}
          </span>
          <Button type="button" variant="ghost" size="sm" className="h-8" disabled={disabled} onClick={undo}>
            <Undo2 className="h-4 w-4" aria-hidden="true" />
            Desfazer
          </Button>
        </div>
      )}

      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => {
          if (disabled) return
          setUndoState(null)
          onChange(event.target.value)
        }}
        className={textareaClassName}
        aria-label={ariaLabel}
        readOnly={disabled}
      />
    </div>
  )
}
