"use client"

import { useMemo, useState } from 'react'
import { ArrowUp, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { diffMinutaSections } from '@/lib/ataMinuta'
import type { AtaMinutaMessage } from '@/data/types'

interface AtaMinutaChatProps {
  messages: AtaMinutaMessage[]
  initialContent: string
  isSending: boolean
  disabled?: boolean
  onSend: (instruction: string) => void
}

// A bolha do assistente não repete texto do modelo — o modelo poderia alegar ter
// mudado algo que não mudou. Ela cita as seções cujo corpo realmente é diferente do
// texto anterior, calculado aqui a partir do conteúdo salvo em cada turno.
function describeChange(previousContent: string, message: AtaMinutaMessage): string {
  const diff = diffMinutaSections(previousContent, message.content)
  if (diff.changedTitles.length === 0) return 'Nenhuma seção foi alterada.'
  const list = diff.changedTitles.join(', ')
  return diff.changedTitles.length === 1 ? `Seção alterada: ${list}.` : `${diff.changedTitles.length} seções alteradas: ${list}.`
}

export function AtaMinutaChat({ messages, initialContent, isSending, disabled, onSend }: AtaMinutaChatProps) {
  const [instruction, setInstruction] = useState('')

  const entries = useMemo(() => {
    const result: Array<{ message: AtaMinutaMessage; summary?: string }> = []
    for (const message of messages) {
      const previousAssistantContent = [...result].reverse().find((entry) => entry.message.role === 'assistant')?.message.content ?? initialContent
      const summary = message.role === 'assistant' ? describeChange(previousAssistantContent, message) : undefined
      result.push({ message, summary })
    }
    return result
  }, [messages, initialContent])

  const send = () => {
    const trimmed = instruction.trim()
    if (!trimmed || isSending) return
    onSend(trimmed)
    setInstruction('')
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-3">
        {entries.length === 0 && (
          <p className="text-sm text-muted-foreground">Peça correções aqui — cada pedido gera uma nova versão da minuta.</p>
        )}
        {entries.map(({ message, summary }) => (
          <div key={message.id} className={message.role === 'user' ? 'ml-auto max-w-[85%] rounded-lg bg-primary/10 px-3 py-2 text-sm' : 'mr-auto max-w-[85%] rounded-lg border bg-muted/30 px-3 py-2 text-sm'}>
            {message.role === 'user' ? (
              <p>{message.content}</p>
            ) : (
              <p className="flex items-center gap-1.5 text-muted-foreground"><Sparkles className="h-3.5 w-3.5 shrink-0" />{summary}</p>
            )}
          </div>
        ))}
        {isSending && <p className="text-sm text-muted-foreground">Aplicando a correção…</p>}
      </div>

      <div className="flex items-end gap-2 border-t pt-3">
        <Textarea
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              send()
            }
          }}
          placeholder="Ex.: reescreva a seção de prestação de contas sem citar valores em reais"
          className="min-h-16 resize-none"
          disabled={disabled || isSending}
          aria-label="Instrução para a minuta"
        />
        <Button type="button" size="icon" disabled={disabled || isSending || !instruction.trim()} onClick={send} aria-label="Enviar instrução">
          <ArrowUp className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
