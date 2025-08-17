import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Comment } from "@/data/fixtures"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Download, FileText, Image, File, Paperclip, Trash2, MoreVertical } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/contexts/AuthContext"

interface CommentsListProps {
  comments: Comment[]
  onDeleteComment?: (commentId: string) => void
}

export function CommentsList({ comments, onDeleteComment }: CommentsListProps) {
  const { userProfile } = useAuth()
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

  // Check if user can delete comment (own comment or admin)
  const canDeleteComment = (comment: Comment) => {
    if (!userProfile) return false
    return comment.author.id === userProfile.id || userProfile.roles?.includes('ADMIN')
  }

  // Sort comments chronologically with newer first
  const sortedComments = [...comments].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  return (
    <div className="space-y-4">
      {sortedComments.map((comment) => (
        <Card key={comment.id}>
          <CardContent className="pt-4">
            <div className="flex gap-3">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="text-xs">
                  {comment.author.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{comment.author.name}</span>
                    {comment.attachments && comment.attachments.length > 0 && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Paperclip className="w-3 h-3" />
                        <span className="text-xs">{comment.attachments.length}</span>
                      </div>
                    )}
                    <span className="text-muted-foreground">•</span>
                    <span className="text-muted-foreground">
                      {formatDistanceToNow(new Date(comment.createdAt), { 
                        addSuffix: true, 
                        locale: ptBR 
                      })}
                    </span>
                  </div>
                  
                  {canDeleteComment(comment) && onDeleteComment && (
                    <AlertDialog>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            <MoreVertical className="w-3 h-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem className="text-destructive focus:text-destructive">
                              <Trash2 className="w-3 h-3 mr-2" />
                              Deletar comentário
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Deletar comentário</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja deletar este comentário? Esta ação não pode ser desfeita.
                            {comment.attachments && comment.attachments.length > 0 && (
                              <span className="block mt-2 font-medium">
                                Todos os anexos ({comment.attachments.length}) também serão removidos.
                              </span>
                            )}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => onDeleteComment(comment.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Deletar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
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