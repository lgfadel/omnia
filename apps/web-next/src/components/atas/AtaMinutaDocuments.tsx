"use client"

import { useId, useRef, useState, type DragEvent } from 'react'
import { FileText, Loader2, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getMinutaDocumentValidationError } from '@/lib/ataMinuta'
import { getMinutaDocumentsTotalSize, getMinutaDocumentsValidationError, MINUTA_DOCUMENT_MAX_SIZE_MB } from '@/lib/ataMinutaDocuments'
import { cn } from '@/lib/utils'
import type { AtaMinutaDocument, AtaMinutaDocumentKind } from '@/data/types'

interface AtaMinutaDocumentsProps {
  documents: AtaMinutaDocument[]
  disabled?: boolean
  onUpload: (file: File, kind: AtaMinutaDocumentKind) => Promise<void>
  onDelete: (documentId: string) => Promise<void>
  onBusyChange?: (busy: boolean) => void
}

const kindLabels: Record<AtaMinutaDocumentKind, string> = {
  convocacao: 'Convocação',
  apuracao: 'Apuração de votação',
  outro: 'Outro documento',
}

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.ceil(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function AtaMinutaDocuments({ documents, disabled, onUpload, onDelete, onBusyChange }: AtaMinutaDocumentsProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const kindId = useId()
  const [kind, setKind] = useState<AtaMinutaDocumentKind>('apuracao')
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const busy = isUploading || deletingId !== null
  const totalSize = getMinutaDocumentsTotalSize(documents)

  const handleFile = async (file: File) => {
    if (disabled || busy) return
    setError(null)
    const validationError = getMinutaDocumentValidationError({ name: file.name, type: file.type, size: file.size })
      ?? getMinutaDocumentsValidationError(documents, file.size)
    if (validationError) {
      setError(validationError)
      if (inputRef.current) inputRef.current.value = ''
      return
    }
    setIsUploading(true)
    onBusyChange?.(true)
    try {
      await onUpload(file, kind)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Não foi possível enviar o documento.')
    } finally {
      setIsUploading(false)
      onBusyChange?.(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault()
    setIsDragging(false)
    if (disabled || busy) return
    if (event.dataTransfer.files.length > 1) {
      setError('Envie um PDF de cada vez.')
      return
    }
    const file = event.dataTransfer.files[0]
    if (file) void handleFile(file)
  }

  const handleDelete = async (documentId: string) => {
    if (disabled || busy) return
    setDeletingId(documentId)
    onBusyChange?.(true)
    setError(null)
    try {
      await onDelete(documentId)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Não foi possível remover o documento.')
    } finally {
      setDeletingId(null)
      onBusyChange?.(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-muted-foreground">Inclua a convocação, a apuração de votos ou outros PDFs que ajudem a registrar a assembleia.</p>
      <div className="space-y-2">
        <Label htmlFor={kindId} className="text-xs text-muted-foreground">Tipo de documento</Label>
        <Select value={kind} onValueChange={(value) => setKind(value as AtaMinutaDocumentKind)}>
          <SelectTrigger id={kindId} disabled={disabled || busy}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="apuracao">Apuração de votação</SelectItem>
            <SelectItem value="convocacao">Convocação</SelectItem>
            <SelectItem value="outro">Outro documento</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Input ref={inputRef} type="file" accept="application/pdf,.pdf" aria-label="PDF de apoio" disabled={disabled || busy} className="hidden"
        onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleFile(file) }} />
      <button type="button" disabled={disabled || busy} onClick={() => inputRef.current?.click()}
        onDragOver={(event) => { event.preventDefault(); if (!disabled && !busy) setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)} onDrop={handleDrop}
        className={cn('flex w-full flex-col items-center gap-2 rounded-lg border border-dashed px-5 py-7 text-center transition-colors hover:border-primary/50 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50', isDragging && 'border-primary bg-primary/5')}>
        {isUploading ? <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin text-primary motion-reduce:animate-none" /> : <Upload aria-hidden="true" className="h-5 w-5 text-primary" />}
        <span className="text-sm font-medium">{isUploading ? 'Enviando PDF…' : 'Selecionar PDF ou arrastar aqui'}</span>
        <span className="text-xs text-muted-foreground">Até {MINUTA_DOCUMENT_MAX_SIZE_MB} MB por arquivo · {MINUTA_DOCUMENT_MAX_SIZE_MB} MB no total</span>
      </button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {documents.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{documents.length} {documents.length === 1 ? 'documento anexado' : 'documentos anexados'} · {formatSize(totalSize)} de {MINUTA_DOCUMENT_MAX_SIZE_MB} MB</p>
          <ul className="divide-y rounded-lg border">
            {documents.map((document) => (
              <li key={document.id} className="flex items-center justify-between gap-3 px-3 py-3 text-sm">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="truncate font-medium" title={document.originalFilename}>{document.originalFilename}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{kindLabels[document.kind]} · {formatSize(document.sizeBytes)}</p>
                  </div>
                </div>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" disabled={disabled || busy}
                  aria-label={`Remover ${document.originalFilename}`} onClick={() => void handleDelete(document.id)}>
                  {deletingId === document.id ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : <p className="text-xs text-muted-foreground">Os documentos são opcionais. A transcrição já serve como base para a minuta.</p>}
    </div>
  )
}
