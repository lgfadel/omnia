"use client"

import { useMemo } from 'react'
import { FileText } from 'lucide-react'
import { parseConvocacao, type ConvocacaoContext } from '@/lib/convocacao'

interface AtaMinutaConvocacaoProps {
  /** Texto da convocação guardado no job de transcrição atual. */
  text?: string
}

// O texto guardado já passou pela leitura da transcrição; reler com o mesmo
// parser devolve os mesmos campos sem gravar nada novo no banco.
function readStoredConvocacao(text: string): ConvocacaoContext | null {
  try {
    return parseConvocacao(text, 0)
  } catch {
    return null
  }
}

export function AtaMinutaConvocacao({ text }: AtaMinutaConvocacaoProps) {
  const convocacao = useMemo(() => (text ? readStoredConvocacao(text) : null), [text])
  if (!text) return null

  const pautaCount = convocacao?.pautaItems.length ?? 0

  return (
    <div className="flex gap-3 rounded-lg border bg-muted/30 px-3 py-3 text-sm">
      <FileText aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0 space-y-1">
        <p className="font-medium">Convocação lida na transcrição</p>
        <ul className="space-y-0.5 text-xs text-muted-foreground">
          {convocacao?.condominio ? <li>{convocacao.condominio}</li> : null}
          {convocacao?.sindico ? <li>{convocacao.sindico}</li> : null}
          {convocacao?.data ? <li>Data: {convocacao.data}</li> : null}
          {pautaCount > 0 ? <li>{pautaCount} {pautaCount === 1 ? 'item de pauta' : 'itens de pauta'}</li> : null}
        </ul>
        <p className="text-xs leading-relaxed text-muted-foreground">O agente já usa estes dados na minuta — não precisa enviar de novo.</p>
      </div>
    </div>
  )
}
