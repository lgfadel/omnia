'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, FileText, Loader2, Trash2, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { balanceteAttachmentsRepoSupabase, type BalanceteAttachment } from '@/repositories/balanceteAttachmentsRepo.supabase'
import { protocoloAttachmentsRepoSupabase, type ProtocoloAttachment } from '@/repositories/protocoloAttachmentsRepo.supabase'
import { useToast } from '@/hooks/use-toast'
import { logger } from '@/lib/logging'

interface ProtocoloAttachmentUploadProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  balanceteId: string
  protocoloId: string
  protocoloNumero: number
  onUploadSuccess?: () => void
}

type ConsolidatedAttachment = {
  id: string
  source: 'legacy' | 'individual'
  name: string
  url: string
  sizeKb?: number
  createdAt: Date
}

export function ProtocoloAttachmentUpload({
  open,
  onOpenChange,
  balanceteId,
  protocoloId,
  protocoloNumero,
  onUploadSuccess,
}: ProtocoloAttachmentUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [balanceteAttachments, setBalanceteAttachments] = useState<BalanceteAttachment[]>([])
  const [legacyAttachments, setLegacyAttachments] = useState<ProtocoloAttachment[]>([])
  const [loadingAttachments, setLoadingAttachments] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (open && balanceteId && protocoloId) {
      void loadAttachments()
    }
  }, [open, balanceteId, protocoloId])

  const consolidatedAttachments = useMemo<ConsolidatedAttachment[]>(
    () =>
      [
        ...balanceteAttachments.map((attachment) => ({
          id: attachment.id,
          source: 'individual' as const,
          name: attachment.name,
          url: attachment.url,
          sizeKb: attachment.sizeKb,
          createdAt: attachment.createdAt,
        })),
        ...legacyAttachments.map((attachment) => ({
          id: attachment.id,
          source: 'legacy' as const,
          name: attachment.name,
          url: attachment.url,
          sizeKb: attachment.sizeKb,
          createdAt: attachment.createdAt,
        })),
      ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    [balanceteAttachments, legacyAttachments]
  )

  const loadAttachments = async () => {
    setLoadingAttachments(true)
    try {
      const [individual, legacy] = await Promise.all([
        balanceteAttachmentsRepoSupabase.listByBalancete(balanceteId),
        protocoloAttachmentsRepoSupabase.listByProtocolo(protocoloId),
      ])

      setBalanceteAttachments(individual)
      setLegacyAttachments(legacy)
    } catch (error) {
      logger.error('Erro ao carregar anexos consolidados:', error)
    } finally {
      setLoadingAttachments(false)
    }
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'Arquivo muito grande',
        description: 'O arquivo deve ter no máximo 10MB.',
        variant: 'destructive',
      })
      return
    }

    setSelectedFile(file)
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    try {
      setUploading(true)
      await balanceteAttachmentsRepoSupabase.uploadFile(balanceteId, protocoloId, selectedFile)
      toast({
        title: 'Anexo enviado com sucesso',
        description: 'O comprovante foi anexado ao balancete.',
      })
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      await loadAttachments()
      await onUploadSuccess?.()
    } catch (error) {
      logger.error('Error uploading balancete attachment:', error)
      toast({
        title: 'Erro',
        description: 'Erro ao anexar o comprovante.',
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (attachment: ConsolidatedAttachment) => {
    try {
      if (attachment.source === 'legacy') {
        await protocoloAttachmentsRepoSupabase.remove(attachment.id)
      } else {
        await balanceteAttachmentsRepoSupabase.remove(attachment.id)
      }

      toast({
        title: 'Anexo removido',
        description: 'O anexo foi removido com sucesso.',
      })

      await loadAttachments()
      await onUploadSuccess?.()
    } catch (error) {
      logger.error('Erro ao remover anexo:', error)
      toast({
        title: 'Erro ao remover anexo',
        variant: 'destructive',
      })
    }
  }

  const handleCancel = () => {
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Anexos do Balancete Enviado</DialogTitle>
          <DialogDescription>
            Protocolo #{String(protocoloNumero).padStart(3, '0')} - visualize o histórico já anexado e adicione um novo comprovante individual para este balancete.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {loadingAttachments ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : consolidatedAttachments.length > 0 ? (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Anexos disponíveis ({consolidatedAttachments.length})</h4>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {consolidatedAttachments.map((attachment) => (
                  <div
                    key={`${attachment.source}-${attachment.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border bg-muted/20"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium break-words">{attachment.name}</p>
                        <p className="text-xs text-muted-foreground">{attachment.sizeKb ?? '-'} KB</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => window.open(attachment.url, '_blank')}
                        title="Baixar"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => void handleDelete(attachment)}
                        title="Remover"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Nenhum anexo disponível para este balancete ainda.
            </div>
          )}

          <div className="flex flex-col gap-4">
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png"
            />

            {!selectedFile ? (
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="h-28 border-dashed">
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <div className="text-sm text-muted-foreground">Clique para selecionar um novo comprovante</div>
                  <div className="text-xs text-muted-foreground">PDF, JPG ou PNG (máx. 10MB)</div>
                </div>
              </Button>
            ) : (
              <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium break-words">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => {
                    setSelectedFile(null)
                    if (fileInputRef.current) {
                      fileInputRef.current.value = ''
                    }
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCancel} disabled={uploading}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleUpload} disabled={!selectedFile || uploading}>
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              'Anexar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
