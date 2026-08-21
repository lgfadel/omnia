"use client"

import { useRef, useState } from 'react'
import { FileText, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getMinutaDocumentValidationError } from '@/lib/ataMinuta'
import type { AtaMinutaDocument, AtaMinutaDocumentKind } from '@/data/types'

interface AtaMinutaDocumentsProps {
  documents: AtaMinutaDocument[]
  disabled?: boolean
  onUpload: (file: File, kind: AtaMinutaDocumentKind) => Promise<void>
  onDelete: (documentId: string) => Promise<void>
}

const kindLabels: Record<AtaMinutaDocumentKind, string> = {
  convocacao: 'Convocação',
  apuracao: 'Apuração de votação',
  outro: 'Outro documento',
}

function formatSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function AtaMinutaDocuments({ documents, disabled, onUpload, onDelete }: AtaMinutaDocumentsProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [kind, setKind] = useState<AtaMinutaDocumentKind>('apuracao')
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleFile = async (file: File) => {
    setError(null)
    const validationError = getMinutaDocumentValidationError({ name: file.name, type: file.type, size: file.size })
    if (validationError) {
      setError(validationError)
      if (inputRef.current) inputRef.current.value = ''
      return
    }
    setIsUploading(true)
    try {
      await onUpload(file, kind)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Não foi possível enviar o documento.')
    } finally {
      setIsUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleDelete = async (documentId: string) => {
    setDeletingId(documentId)
    setError(null)
    try {
      await onDelete(documentId)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Não foi possível remover o documento.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">PDFs de apoio — apuração de votação, convocação — usados na geração e nos ajustes da minuta.</p>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {documents.length > 0 && (
        <ul className="space-y-2">
          {documents.map((document) => (
            <li key={document.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-violet-600" />
                <div className="min-w-0">
                  <p className="truncate font-medium">{document.originalFilename}</p>
                  <p className="text-xs text-muted-foreground">{kindLabels[document.kind]} · {formatSize(document.sizeBytes)}</p>
                </div>
              </div>
              <Button
                type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                disabled={disabled || deletingId === document.id}
                aria-label={`Remover ${document.originalFilename}`}
                onClick={() => void handleDelete(document.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Select value={kind} onValueChange={(value) => setKind(value as AtaMinutaDocumentKind)}>
          <SelectTrigger className="w-52" disabled={disabled || isUploading}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="apuracao">Apuração de votação</SelectItem>
            <SelectItem value="convocacao">Convocação</SelectItem>
            <SelectItem value="outro">Outro documento</SelectItem>
          </SelectContent>
        </Select>
        <Input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void handleFile(file)
          }}
        />
        <Button type="button" variant="outline" size="sm" disabled={disabled || isUploading} onClick={() => inputRef.current?.click()}>
          <Upload className="mr-2 h-4 w-4" />
          {isUploading ? 'Enviando…' : 'Anexar PDF'}
        </Button>
      </div>
    </div>
  )
}
