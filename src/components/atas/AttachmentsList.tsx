import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Attachment } from "@/data/fixtures"
import { Download, FileText, Trash2, X } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { useState } from "react"
import { toast } from "@/components/ui/use-toast"

interface AttachmentsListProps {
  attachments: Attachment[]
  onDelete?: (attachmentId: string) => void
  canDelete?: boolean
}

export function AttachmentsList({ attachments, onDelete, canDelete }: AttachmentsListProps) {
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null)

  const formatFileSize = (sizeKB?: number) => {
    if (!sizeKB) return ""
    if (sizeKB < 1024) return `${sizeKB} KB`
    return `${(sizeKB / 1024).toFixed(1)} MB`
  }

  const getFileIcon = (mime?: string) => {
    if (mime?.includes('pdf')) return '📄'
    if (mime?.includes('image')) return '🖼️'
    if (mime?.includes('document') || mime?.includes('docx')) return '📝'
    if (mime?.includes('spreadsheet') || mime?.includes('xlsx')) return '📊'
    return '📎'
  }

  const canPreview = (mime?: string) => {
    if (!mime) return false
    return mime.includes('image') || mime.includes('pdf')
  }

  const handleAttachmentClick = (attachment: Attachment) => {
    if (canPreview(attachment.mime)) {
      setPreviewAttachment(attachment)
    } else {
      // Download directly for non-previewable files
      window.open(attachment.url, '_blank')
    }
  }

  const downloadAttachment = async (attachment: Attachment) => {
    try {
      // Handle blob/data URLs
      if (attachment.url.startsWith('blob:')) {
        // If blob URL is from another origin, it is not retrievable — inform the user
        if (!attachment.url.includes(window.location.origin)) {
          toast({
            title: 'Arquivo indisponível',
            description: 'Este anexo foi enviado em outro ambiente. Reenvie o arquivo para baixá-lo.',
            variant: 'destructive',
          })
          return
        }
        const a = document.createElement('a')
        a.href = attachment.url
        a.download = attachment.name
        document.body.appendChild(a)
        a.click()
        a.remove()
        return
      }

      if (attachment.url.startsWith('data:')) {
        const a = document.createElement('a')
        a.href = attachment.url
        a.download = attachment.name
        document.body.appendChild(a)
        a.click()
        a.remove()
        return
      }

      // Fetch and force download for regular URLs
      const response = await fetch(attachment.url)
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)

      const a = document.createElement('a')
      a.href = objectUrl
      a.download = attachment.name
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objectUrl)
    } catch (err) {
      toast({
        title: 'Falha ao baixar',
        description: 'Não foi possível baixar o arquivo. Tente reenviar o anexo.',
        variant: 'destructive',
      })
    }
  }

  const renderPreviewContent = (attachment: Attachment) => {
    if (attachment.mime?.includes('image')) {
      return (
        <div className="flex justify-center">
          <img 
            src={attachment.url} 
            alt={attachment.name}
            className="max-w-full max-h-[70vh] object-contain"
          />
        </div>
      )
    }
    
    if (attachment.mime?.includes('pdf')) {
      return (
        <div className="w-full h-[70vh]">
          <iframe 
            src={attachment.url}
            className="w-full h-full border-0"
            title={attachment.name}
          />
        </div>
      )
    }
    
    return null
  }

  if (attachments.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum anexo ainda.
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {attachments.map((attachment) => (
          <Card key={attachment.id}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="text-2xl">
                  {getFileIcon(attachment.mime)}
                </div>
                
                <div 
                  className="flex-1 min-w-0 cursor-pointer hover:bg-muted/50 rounded p-2 -m-2 transition-colors"
                  onClick={() => handleAttachmentClick(attachment)}
                  title={canPreview(attachment.mime) ? "Clique para visualizar" : "Clique para baixar"}
                >
                  <p className="font-medium truncate">{attachment.name}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {attachment.sizeKB && (
                      <>
                        <span>{formatFileSize(attachment.sizeKB)}</span>
                        <span>•</span>
                      </>
                    )}
                    <span>
                      {formatDistanceToNow(new Date(attachment.createdAt), { 
                        addSuffix: true, 
                        locale: ptBR 
                      })}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={async (e) => {
                      e.stopPropagation()
                      await downloadAttachment(attachment)
                    }}
                    title="Baixar arquivo"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  
                  {canDelete && onDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(attachment.id)
                      }}
                      title="Remover anexo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!previewAttachment} onOpenChange={() => setPreviewAttachment(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="truncate">{previewAttachment?.name}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPreviewAttachment(null)}
                className="h-6 w-6"
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          {previewAttachment && renderPreviewContent(previewAttachment)}
        </DialogContent>
      </Dialog>
    </>
  )
}