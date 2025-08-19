import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { ticketCommentsRepoSupabase, type TicketComment } from '@/repositories/ticketCommentsRepo.supabase';
import { toast } from 'sonner';

interface TicketCommentsListProps {
  ticketId: string;
  onCommentsChange?: () => void;
}

export const TicketCommentsList = ({ ticketId, onCommentsChange }: TicketCommentsListProps) => {
  const { userProfile } = useAuth();
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [loading, setLoading] = useState(true);

  const loadComments = async () => {
    try {
      setLoading(true);
      const commentsData = await ticketCommentsRepoSupabase.list(ticketId);
      setComments(commentsData);
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
      await ticketCommentsRepoSupabase.remove(commentId);
      await loadComments();
      onCommentsChange?.();
      toast.success('Comentário excluído com sucesso');
    } catch (error) {
      console.error('Erro ao excluir comentário:', error);
      toast.error('Erro ao excluir comentário');
    }
  };

  if (loading) {
    return <div>Carregando comentários...</div>;
  }

  if (comments.length === 0) {
    return <div className="text-muted-foreground">Nenhum comentário encontrado.</div>;
  }

  return (
    <div className="space-y-4">
      {comments.map((comment) => (
        <Card key={comment.id}>
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-2">
                  {format(new Date(comment.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", {
                    locale: ptBR,
                  })}
                </p>
                <p className="whitespace-pre-wrap">{comment.body}</p>
              </div>
              {(userProfile?.id === comment.created_by || userProfile?.roles?.includes('ADMIN')) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteComment(comment.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};