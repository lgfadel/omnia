import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { ticketCommentsRepoSupabase } from '@/repositories/ticketCommentsRepo.supabase';
import { toast } from 'sonner';

interface TicketCommentInputProps {
  ticketId: string;
  onCommentAdded?: () => void;
}

export const TicketCommentInput = ({ ticketId, onCommentAdded }: TicketCommentInputProps) => {
  const { userProfile } = useAuth();
  const [body, setBody] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!body.trim() || !userProfile) return;

    try {
      setIsSubmitting(true);
      await ticketCommentsRepoSupabase.create({
        ticket_id: ticketId,
        body: body.trim(),
        created_by: userProfile.id,
        author_id: userProfile.id,
      });

      setBody('');
      onCommentAdded?.();
      toast.success('Comentário adicionado com sucesso');
    } catch (error) {
      console.error('Erro ao adicionar comentário:', error);
      toast.error('Erro ao adicionar comentário');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle Ctrl+Enter or Cmd+Enter for submit
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit(e as any);
    }
    // Let all other keyboard events pass through naturally
  };

  return (
    <Card>
      <CardContent className="p-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Adicione um comentário... (Ctrl+Enter para enviar)"
            rows={3}
            disabled={isSubmitting}
          />
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={!body.trim() || isSubmitting}
              size="sm"
            >
              {isSubmitting ? 'Adicionando...' : 'Adicionar Comentário'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};