import { useState, useEffect } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Trash2, MoreVertical, Edit, Check, X, Download, FileText, Image, File, Paperclip } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/components/auth/AuthProvider';
import { generateUserColor, getUserInitials } from '@/lib/userColors';
import { ticketCommentsRepoSupabase, type TicketComment } from '@/repositories/ticketCommentsRepo.supabase';
import { ataCommentsRepoSupabase, type AtaComment } from '@/repositories/ataCommentsRepo.supabase';
import { ticketAttachmentsRepoSupabase, type TicketAttachment } from '@/repositories/ticketAttachmentsRepo.supabase';
import { secretariosRepoSupabase } from '@/repositories/secretariosRepo.supabase';
import { ImagePreviewModal } from '@/components/ui/image-preview-modal';
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
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface TicketCommentsListProps {
  ticketId: string;
  onCommentsChange?: () => void;
  contextType?: 'ticket' | 'ata';
}

interface CommentWithAttachments extends TicketComment {
  attachments?: TicketAttachment[];
  author?: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
    color?: string;
  };
}

export const TicketCommentsList = ({ ticketId, onCommentsChange, contextType = 'ticket' }: TicketCommentsListProps) => {
  const { userProfile } = useAuth();
  const [comments, setComments] = useState<CommentWithAttachments[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const loadComments = async () => {
    try {
      setLoading(true);
      const repo = contextType === 'ata' ? ataCommentsRepoSupabase : ticketCommentsRepoSupabase;
      const commentsData = await repo.list(ticketId);
      
      // Load users and attachments for each comment
      const [users, allAttachments] = await Promise.all([
        secretariosRepoSupabase.list(),
        ticketAttachmentsRepoSupabase.list(ticketId)
      ]);

      const commentsWithAttachments = commentsData.map((comment) => {
        try {
          const commentAttachments = allAttachments.filter(att => (att as any).comment_id === comment.id);
          const author = users.find(user => user.id === comment.author_id);
          
          return {
            ...comment,
            attachments: commentAttachments,
            author: author ? {
              id: author.id,
              name: author.name,
              email: author.email,
              avatarUrl: author.avatarUrl,
              color: author.color
            } : {
              id: comment.author_id,
              name: 'Usuário não encontrado',
              email: '',
            }
          };
        } catch (error) {
          console.error('Erro ao carregar anexos do comentário:', error);
          return {
            ...comment,
            attachments: [],
            author: {
              id: comment.author_id,
              name: 'Usuário não encontrado',
              email: '',
            }
          };
        }
      });
      
      setComments(commentsWithAttachments);
    } catch (error) {
      console.error('Erro ao carregar comentários:', error);
      toast.error('Erro ao carregar comentários');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ticketId) {
      loadComments();
    }
  }, [ticketId]);

  const handleDeleteComment = async (commentId: string) => {
    try {
      // Delete comment attachments first
      const comment = comments.find(c => c.id === commentId);
      if (comment?.attachments) {
        for (const attachment of comment.attachments) {
          await ticketAttachmentsRepoSupabase.remove(attachment.id);
        }
      }
      
      const repo = contextType === 'ata' ? ataCommentsRepoSupabase : ticketCommentsRepoSupabase;
      await repo.remove(commentId);
      await loadComments();
      onCommentsChange?.();
      toast.success('Comentário excluído com sucesso');
    } catch (error) {
      console.error('Erro ao excluir comentário:', error);
      toast.error('Erro ao excluir comentário');
    }
  };

  const handleUpdateComment = async (commentId: string, body: string) => {
    try {
      const repo = contextType === 'ata' ? ataCommentsRepoSupabase : ticketCommentsRepoSupabase;
      await repo.update(commentId, body);
      await loadComments();
      onCommentsChange?.();
      toast.success('Comentário atualizado com sucesso');
    } catch (error) {
      console.error('Erro ao atualizar comentário:', error);
      toast.error('Erro ao atualizar comentário');
    }
  };

  const downloadAttachment = async (attachment: TicketAttachment) => {
    try {
      // Handle blob/data URLs
      if (attachment.url.startsWith('blob:')) {
        // If blob URL is from another origin, it is not retrievable — inform the user
        if (!attachment.url.includes(window.location.origin)) {
          toast.error('Arquivo indisponível - Este anexo foi enviado em outro ambiente. Reenvie o arquivo para baixá-lo.');
          return;
        }
        const a = document.createElement('a');
        a.href = attachment.url;
        a.download = attachment.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        return;
      }

      if (attachment.url.startsWith('data:')) {
        const a = document.createElement('a');
        a.href = attachment.url;
        a.download = attachment.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        return;
      }

      // Fetch and force download for regular URLs
      const response = await fetch(attachment.url);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = attachment.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      toast.error('Falha ao baixar - Não foi possível baixar o arquivo. Tente reenviar o anexo.');
    }
  };

  const getFileIcon = (mime?: string) => {
    if (!mime) return <File className="w-4 h-4" />;
    
    if (mime.startsWith('image/')) return <Image className="w-4 h-4" />;
    if (mime.includes('pdf') || mime.includes('document') || mime.includes('text')) return <FileText className="w-4 h-4" />;
    
    return <File className="w-4 h-4" />;
  };

  const formatFileSize = (sizeKB?: number) => {
    if (!sizeKB) return '';
    return sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`;
  };

  const canDeleteComment = (comment: CommentWithAttachments) => {
    if (!userProfile) return false;
    return comment.created_by === userProfile.id || userProfile.roles?.includes('ADMIN');
  };

  const canEditComment = (comment: CommentWithAttachments) => {
    if (!userProfile) return false;
    if (comment.created_by !== userProfile.id) return false;
    
    const commentDate = new Date(comment.created_at);
    const now = new Date();
    const diffMinutes = (now.getTime() - commentDate.getTime()) / (1000 * 60);
    
    return diffMinutes <= 10;
  };

  const handleEditStart = (comment: CommentWithAttachments) => {
    setEditingComment(comment.id);
    setEditBody(comment.body || '');
  };

  const handleEditCancel = () => {
    setEditingComment(null);
    setEditBody('');
  };

  const handleEditSave = (commentId: string) => {
    if (editBody.trim()) {
      handleUpdateComment(commentId, editBody.trim());
      setEditingComment(null);
      setEditBody('');
    }
  };

  if (loading) {
    return <div>Carregando comentários...</div>;
  }

  if (comments.length === 0) {
    return <div className="text-muted-foreground">Nenhum comentário encontrado.</div>;
  }

  const sortedComments = [...comments].sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return (
    <div className="space-y-4">
      {sortedComments.map((comment) => (
        <Card key={comment.id}>
          <CardContent className="p-4">
            <div className="flex gap-3">
              <Avatar className="w-8 h-8 flex-shrink-0">
                <AvatarFallback 
                  style={{ backgroundColor: comment.author?.color || generateUserColor(comment.author?.id || comment.created_by) }}
                  className="text-white text-sm font-medium"
                >
                  {getUserInitials(comment.author?.name || comment.created_by)}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {comment.author?.name || comment.created_by}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(comment.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </span>
                    {comment.attachments && comment.attachments.length > 0 && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Paperclip className="w-3 h-3" />
                        <span>{comment.attachments.length}</span>
                      </div>
                    )}
                  </div>
                  
                  {(canDeleteComment(comment) || canEditComment(comment)) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <MoreVertical className="w-3 h-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canEditComment(comment) && (
                          <DropdownMenuItem onClick={() => handleEditStart(comment)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                        )}
                        {canDeleteComment(comment) && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                <Trash2 className="w-4 h-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir este comentário?
                                  {comment.attachments && comment.attachments.length > 0 && (
                                    <span className="block mt-2 text-sm">
                                      Isso também removerá {comment.attachments.length} anexo(s) associado(s).
                                    </span>
                                  )}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteComment(comment.id)}>
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                
                {editingComment === comment.id ? (
                  <div className="space-y-2">
                    <Input
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      className="min-h-[60px]"
                      placeholder="Editar comentário..."
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleEditSave(comment.id)}
                        disabled={!editBody.trim()}
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Salvar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleEditCancel}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm whitespace-pre-wrap break-words">
                    {comment.body}
                  </div>
                )}
                
                {comment.attachments && comment.attachments.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {comment.attachments.map((attachment) => (
                        <div key={attachment.id} className="flex items-center gap-2 bg-muted rounded-md px-2 py-1">
                          {getFileIcon(attachment.mime_type)}
                          <div className="flex flex-col">
                            {attachment.mime_type?.startsWith('image/') ? (
                              <button
                                className="text-xs font-medium truncate max-w-32 text-left text-primary hover:text-primary/80 hover:underline cursor-pointer transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewImage(attachment.url);
                                }}
                                title="Clique para visualizar a imagem"
                              >
                                {attachment.name}
                              </button>
                            ) : (
                              <span className="text-xs font-medium truncate max-w-32">{attachment.name}</span>
                            )}
                            {attachment.size_kb && (
                              <span className="text-xs text-muted-foreground">{formatFileSize(attachment.size_kb)}</span>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={async (e) => {
                              e.stopPropagation();
                              await downloadAttachment(attachment);
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
      
      <ImagePreviewModal
         isOpen={!!previewImage}
         imageUrl={previewImage || ''}
         imageName="Anexo"
         onClose={() => setPreviewImage(null)}
         onDownload={async () => {
           if (previewImage) {
             const attachment = comments
               .flatMap(c => c.attachments || [])
               .find(a => a.url === previewImage);
             if (attachment) {
               await downloadAttachment(attachment);
             }
           }
         }}
       />
    </div>
  );
};