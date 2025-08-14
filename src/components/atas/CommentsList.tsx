import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Comment } from "@/data/fixtures"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Download, FileText, Image, File } from "lucide-react"

interface CommentsListProps {
  comments: Comment[]
}

export function CommentsList({ comments }: CommentsListProps) {
  if (comments.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum comentário ainda.
      </div>
    )
  }

  const getFileIcon = (mime?: string) => {
    if (!mime) return <File className="w-4 h-4" />
    
    if (mime.startsWith('image/')) return <Image className="w-4 h-4" />
    if (mime.includes('pdf') || mime.includes('document') || mime.includes('text')) return <FileText className="w-4 h-4" />
    
    return <File className="w-4 h-4" />
  }

  const formatFileSize = (sizeKB?: number) => {
    if (!sizeKB) return ''
    return sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`
  }

  return (
    <div className="space-y-4">
      {comments.map((comment) => (
        <Card key={comment.id}>
          <CardContent className="pt-4">
            <div className="flex gap-3">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="text-xs">
                  {comment.author.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{comment.author.name}</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-muted-foreground">
                    {formatDistanceToNow(new Date(comment.createdAt), { 
                      addSuffix: true, 
                      locale: ptBR 
                    })}
                  </span>
                </div>
                
                {comment.body && (
                  <p className="text-sm leading-relaxed">{comment.body}</p>
                )}
                
                {comment.attachments && comment.attachments.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {comment.attachments.map((attachment) => (
                        <div key={attachment.id} className="flex items-center gap-2 bg-muted rounded-md px-2 py-1">
                          {getFileIcon(attachment.mime)}
                          <div className="flex flex-col">
                            <span className="text-xs font-medium truncate max-w-32">{attachment.name}</span>
                            {attachment.sizeKB && (
                              <span className="text-xs text-muted-foreground">{formatFileSize(attachment.sizeKB)}</span>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => window.open(attachment.url, '_blank')}
                          >
                            <Download className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}