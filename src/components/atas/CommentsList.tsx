import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Comment } from "@/data/fixtures"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Download, FileText, Image, File, Paperclip, Trash2, MoreVertical, Edit, Check, X } from "lucide-react"
import { useState } from "react"
import { generateUserColor, getUserInitials } from "@/lib/userColors"
import { toast } from "@/components/ui/use-toast"
import { ImagePreviewModal } from "@/components/ui/image-preview-modal"
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
  onUpdateComment?: (commentId: string, body: string) => void
}

export function CommentsList({ comments, onDeleteComment, onUpdateComment }: CommentsListProps) {
  const { userProfile } = useAuth()
  const [editingComment, setEditingComment] = useState<string | null>(null)
  const [editBody, setEditBody] = useState("")
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null)

  const downloadAttachment = async (attachment: any) => {
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

  // Check if user can edit comment (own comment within 10 minutes)
  const canEditComment = (comment: Comment) => {
    if (!userProfile || !onUpdateComment) return false
    if (comment.author.id !== userProfile.id) return false
    
    const commentDate = new Date(comment.createdAt)
    const now = new Date()
    const diffMinutes = (now.getTime() - commentDate.getTime()) / (1000 * 60)
    
    return diffMinutes <= 10
  }

  const handleEditStart = (comment: Comment) => {
    setEditingComment(comment.id)
    setEditBody(comment.body || "")
  }

  const handleEditCancel = () => {
    setEditingComment(null)
    setEditBody("")
  }

  const handleEditSave = (commentId: string) => {
    if (onUpdateComment && editBody.trim()) {
      onUpdateComment(commentId, editBody.trim())
      setEditingComment(null)
      setEditBody("")
    }
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
                <AvatarFallback 
                  className="text-xs text-white font-medium"
                  style={{ 
                    backgroundColor: comment.author.color && typeof comment.author.color === 'string' && comment.author.color.trim() !== ''
              ? comment.author.color
              : generateUserColor(comment.author.id, comment.author.name) 
                  }}
                >
                  {getUserInitials(comment.author.name)}
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
                  
                   {(canDeleteComment(comment) || canEditComment(comment)) && (
                    <AlertDialog>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            <MoreVertical className="w-3 h-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canEditComment(comment) && (
                            <DropdownMenuItem onClick={() => handleEditStart(comment)}>
                              <Edit className="w-3 h-3 mr-2" />
                              Editar comentário
                            </DropdownMenuItem>
                          )}
                          {canDeleteComment(comment) && onDeleteComment && (
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem className="text-destructive focus:text-destructive">
                                <Trash2 className="w-3 h-3 mr-2" />
                                Deletar comentário
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                          )}
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
                  <>
                    {editingComment === comment.id ? (
                      <div className="flex gap-2 items-center">
                        <Input
                          value={editBody}
                          onChange={(e) => setEditBody(e.target.value)}
                          className="flex-1"
                          placeholder="Editar comentário..."
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleEditSave(comment.id)
                            } else if (e.key === 'Escape') {
                              handleEditCancel()
                            }
                          }}
                          autoFocus
                        />
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => handleEditSave(comment.id)}
                          className="h-8 w-8 p-0"
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={handleEditCancel}
                          className="h-8 w-8 p-0"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm leading-relaxed">{comment.body}</p>
                    )}
                  </>
                )}
                
                {comment.attachments && comment.attachments.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {comment.attachments.map((attachment) => (
                        <div key={attachment.id} className="flex items-center gap-2 bg-muted rounded-md px-2 py-1">
                          {getFileIcon(attachment.mime)}
                          <div className="flex flex-col">
                            {attachment.mime?.startsWith('image/') ? (
                              <button
                                className="text-xs font-medium truncate max-w-32 text-left text-primary hover:text-primary/80 hover:underline cursor-pointer transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setPreviewImage({ url: attachment.url, name: attachment.name })
                                }}
                                title="Clique para visualizar a imagem"
                              >
                                {attachment.name}
                              </button>
                            ) : (
                              <span className="text-xs font-medium truncate max-w-32">{attachment.name}</span>
                            )}
                            {attachment.sizeKB && (
                              <span className="text-xs text-muted-foreground">{formatFileSize(attachment.sizeKB)}</span>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={async (e) => {
                              e.stopPropagation()
                              await downloadAttachment(attachment)
                            }}
                            title="Baixar arquivo"
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
      
      {/* Image Preview Modal */}
      <ImagePreviewModal
        isOpen={!!previewImage}
        onClose={() => setPreviewImage(null)}
        imageUrl={previewImage?.url || ""}
        imageName={previewImage?.name || ""}
        onDownload={previewImage ? () => downloadAttachment({ url: previewImage.url, name: previewImage.name }) : undefined}
      />
    </div>
  )
}