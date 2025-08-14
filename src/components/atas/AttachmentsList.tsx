import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Attachment } from "@/data/fixtures"
import { Download, FileText, Trash2 } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"

interface AttachmentsListProps {
  attachments: Attachment[]
  onDelete?: (attachmentId: string) => void
  canDelete?: boolean
}

export function AttachmentsList({ attachments, onDelete, canDelete }: AttachmentsListProps) {
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

  if (attachments.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum anexo ainda.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {attachments.map((attachment) => (
        <Card key={attachment.id}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="text-2xl">
                {getFileIcon(attachment.mime)}
              </div>
              
              <div className="flex-1 min-w-0">
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
                  onClick={() => window.open(attachment.url, '_blank')}
                  title="Baixar arquivo"
                >
                  <Download className="w-4 h-4" />
                </Button>
                
                {canDelete && onDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => onDelete(attachment.id)}
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
  )
}