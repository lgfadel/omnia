import { useState, useEffect } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Trash2, MoreVertical, Edit, Check, X, Download, FileText, Image, File, Paperclip } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { generateUserColor, getUserInitials } from '@/lib/userColors';
import { CrmComment, crmCommentsRepoSupabase } from '@/repositories/crmCommentsRepo.supabase';
import { CrmAttachment, crmAttachmentsRepoSupabase } from '@/repositories/crmAttachmentsRepo.supabase';
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

interface CrmCommentsListProps {
  leadId: string;
  onCommentsChange?: () => void;
}

interface CommentWithAttachments extends CrmComment {
  attachments?: CrmAttachment[];
  author?: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
    color?: string;
  };
}

export const CrmCommentsList = ({ leadId, onCommentsChange }: CrmCommentsListProps) => {
  const { userProfile } = useAuth();
  const [comments, setComments] = useState<CommentWithAttachments[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);

  const loadComments = async () => {
    try {
      setLoading(true);
      const commentsData = await crmCommentsRepoSupabase.getByLeadId(leadId);
      
      // Load users and attachments for each comment
      const [users, allAttachments] = await Promise.all([
        secretariosRepoSupabase.list(),
        crmAttachmentsRepoSupabase.list(leadId)
      ]);

      const commentsWithAttachments = commentsData.map((comment) => {
        try {
          const commentAttachments = allAttachments.filter(att => att.comment_id === comment.id);
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
    if (leadId) {
      loadComments();
    }
  }, [leadId]);

  const handleDeleteComment = async (commentId: string) => {
    try {
      // Delete comment attachments first
      const comment = comments.find(c => c.id === commentId);
      if (comment?.attachments) {
        for (const attachment of comment.attachments) {
          await crmAttachmentsRepoSupabase.remove(attachment.id);
        }
      }
      
      await crmCommentsRepoSupabase.remove(commentId);
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
      await crmCommentsRepoSupabase.update(commentId, { body });
      await loadComments();
      onCommentsChange?.();
      toast.success('Comentário atualizado com sucesso');
    } catch (error) {
      console.error('Erro ao atualizar comentário:', error);
      toast.error('Erro ao atualizar comentário');
    }
  };

  const startEditing = (comment: CommentWithAttachments) => {
    setEditingComment(comment.id);
    setEditBody(comment.body);
  };

  const cancelEditing = () => {
    setEditingComment(null);
    setEditBody('');
  };

  const saveEdit = async () => {
    if (editingComment && editBody.trim()) {
      await handleUpdateComment(editingComment, editBody.trim());
      setEditingComment(null);
      setEditBody('');
    }
  };

  const getFileIcon = (mimeType: string | null) => {
    if (!mimeType) return File;
    
    if (mimeType.startsWith('image/')) return Image;
    if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text')) return FileText;
    return File;
  };

  const isImage = (mimeType: string | null) => {
    return mimeType?.startsWith('image/') || false;
  };

  const handleAttachmentClick = (attachment: CrmAttachment) => {
    if (isImage(attachment.mime_type)) {
      setPreviewImage({ url: attachment.url, name: attachment.name });
    } else {
      window.open(attachment.url, '_blank');
    }
  };

  const canEditOrDelete = (comment: CommentWithAttachments) => {
    if (!userProfile) return false;
    return comment.author_id === userProfile.id || userProfile.roles.includes('ADMIN');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm text-gray-500">Carregando comentários...</div>
      </div>
    );
  }

  if (comments.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-sm text-gray-500">Nenhum comentário ainda.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {comments.map((comment) => {
        const author = comment.author || {
          id: comment.author_id,
          name: 'Usuário não encontrado',
          email: '',
        };
        
        const userColor = author.color || generateUserColor(author.name);
        const userInitials = getUserInitials(author.name);
        
        return (
          <Card key={comment.id} className="border border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-start space-x-3">
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback 
                    className="text-xs font-medium text-white"
                    style={{ backgroundColor: userColor }}
                  >
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-900">
                        {author.name}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(comment.created_at), {
                          addSuffix: true,
                          locale: ptBR
                        })}
                      </span>
                    </div>
                    
                    {canEditOrDelete(comment) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => startEditing(comment)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir este comentário? Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleDeleteComment(comment.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                  
                  <div className="mt-2">
                    {editingComment === comment.id ? (
                      <div className="space-y-2">
                        <Input
                          value={editBody}
                          onChange={(e) => setEditBody(e.target.value)}
                          className="text-sm"
                          autoFocus
                        />
                        <div className="flex space-x-2">
                          <Button size="sm" onClick={saveEdit}>
                            <Check className="h-4 w-4 mr-1" />
                            Salvar
                          </Button>
                          <Button size="sm" variant="outline" onClick={cancelEditing}>
                            <X className="h-4 w-4 mr-1" />
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {comment.body}
                      </p>
                    )}
                  </div>
                  
                  {comment.attachments && comment.attachments.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center text-xs text-gray-500">
                        <Paperclip className="h-3 w-3 mr-1" />
                        {comment.attachments.length} anexo(s)
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {comment.attachments.map((attachment) => {
                          const IconComponent = getFileIcon(attachment.mime_type);
                          return (
                            <div
                              key={attachment.id}
                              className="flex items-center space-x-2 p-2 bg-gray-50 rounded-md cursor-pointer hover:bg-gray-100 transition-colors"
                              onClick={() => handleAttachmentClick(attachment)}
                            >
                              <IconComponent className="h-4 w-4 text-gray-500 flex-shrink-0" />
                              <span className="text-xs text-gray-700 truncate flex-1">
                                {attachment.name}
                              </span>
                              {attachment.size_kb && (
                                <span className="text-xs text-gray-500">
                                  {(attachment.size_kb / 1024).toFixed(1)} MB
                                </span>
                              )}
                              <Download className="h-3 w-3 text-gray-400" />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
      
      <ImagePreviewModal
        isOpen={!!previewImage}
        onClose={() => setPreviewImage(null)}
        imageUrl={previewImage?.url || ''}
        imageName={previewImage?.name || ''}
      />
    </div>
  );
};