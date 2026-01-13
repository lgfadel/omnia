'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Trash2, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { admissaoCommentsRepoSupabase, type AdmissaoComment } from '@/repositories/admissaoCommentsRepo.supabase';
import { useAuthStore } from '@/stores/auth.store';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logging';

interface AdmissaoCommentsListProps {
  admissaoId: string;
}

export function AdmissaoCommentsList({ admissaoId }: AdmissaoCommentsListProps) {
  const [comments, setComments] = useState<AdmissaoComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<AdmissaoComment | null>(null);

  const { userProfile } = useAuthStore();
  const { toast } = useToast();

  useEffect(() => {
    loadComments();
  }, [admissaoId]);

  const loadComments = async () => {
    try {
      setLoading(true);
      const data = await admissaoCommentsRepoSupabase.listByAdmissao(admissaoId);
      setComments(data);
    } catch (error) {
      logger.error('Error loading comments:', error);
      toast({ title: 'Erro', description: 'Erro ao carregar comentários', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !userProfile?.id) return;

    try {
      setSubmitting(true);
      const comment = await admissaoCommentsRepoSupabase.create(
        admissaoId,
        userProfile.id,
        newComment.trim()
      );
      setComments([...comments, comment]);
      setNewComment('');
      toast({ title: 'Sucesso', description: 'Comentário adicionado' });
    } catch (error) {
      logger.error('Error creating comment:', error);
      toast({ title: 'Erro', description: 'Erro ao adicionar comentário', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (comment: AdmissaoComment) => {
    setCommentToDelete(comment);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!commentToDelete) return;

    try {
      await admissaoCommentsRepoSupabase.remove(commentToDelete.id);
      setComments(comments.filter(c => c.id !== commentToDelete.id));
      toast({ title: 'Sucesso', description: 'Comentário removido' });
    } catch (error) {
      logger.error('Error deleting comment:', error);
      toast({ title: 'Erro', description: 'Erro ao remover comentário', variant: 'destructive' });
    } finally {
      setDeleteDialogOpen(false);
      setCommentToDelete(null);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Comentários ({comments.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-4 pr-4">
            {comments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum comentário ainda.
              </p>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="flex gap-3 group">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={comment.authorAvatarUrl} />
                    <AvatarFallback style={{ backgroundColor: comment.authorColor }}>
                      {getInitials(comment.authorName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{comment.authorName}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(comment.createdAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      {userProfile?.id === comment.authorId && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleDeleteClick(comment)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{comment.body}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <form onSubmit={handleSubmit} className="space-y-2">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Adicionar um comentário..."
            rows={2}
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={submitting || !newComment.trim()}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Comentar
            </Button>
          </div>
        </form>
      </CardContent>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir comentário?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
