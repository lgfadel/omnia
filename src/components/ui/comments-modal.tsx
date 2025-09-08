import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TicketCommentsList } from '@/components/tickets/TicketCommentsList';
import { TicketCommentInput } from '@/components/tickets/TicketCommentInput';
import { MessageCircle } from 'lucide-react';
import { ticketCommentsRepoSupabase } from '@/repositories/ticketCommentsRepo.supabase';
import { ataCommentsRepoSupabase } from '@/repositories/ataCommentsRepo.supabase';
import { useEscapeKey } from '@/hooks/useEscapeKey';

interface CommentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticketId: string;
  ticketTitle?: string;
  onCommentCountChange?: (newCount: number) => void;
  contextType?: 'ticket' | 'ata';
}

export function CommentsModal({ isOpen, onClose, ticketId, ticketTitle, onCommentCountChange, contextType = 'ticket' }: CommentsModalProps) {
  const [commentsCount, setCommentsCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  // Hook para fechar modal com ESC
  useEscapeKey(onClose, isOpen);

  const loadCommentsCount = async () => {
    if (!ticketId) return;
    
    try {
      const repo = contextType === 'ata' ? ataCommentsRepoSupabase : ticketCommentsRepoSupabase;
      const comments = await repo.list(ticketId);
      setCommentsCount(comments.length);
    } catch (error) {
      console.error('Erro ao carregar contagem de comentários:', error);
    }
  };

  useEffect(() => {
    if (isOpen && ticketId) {
      loadCommentsCount();
    }
  }, [isOpen, ticketId, refreshKey]);

  const handleCommentsChange = async () => {
    setRefreshKey(prev => prev + 1);
    await loadCommentsCount();
    // Notifica o componente pai sobre a mudança no contador
    if (onCommentCountChange) {
      const repo = contextType === 'ata' ? ataCommentsRepoSupabase : ticketCommentsRepoSupabase;
      const comments = await repo.list(ticketId);
      onCommentCountChange(comments.length);
    }
  };

  const handleCommentAdded = async () => {
    await handleCommentsChange();
    // Notifica o componente pai sobre a mudança no contador
    if (onCommentCountChange) {
      const repo = contextType === 'ata' ? ataCommentsRepoSupabase : ticketCommentsRepoSupabase;
      const comments = await repo.list(ticketId);
      onCommentCountChange(comments.length);
    }
    // Fecha o modal após adicionar comentário
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            Comentários {ticketTitle && `- ${ticketTitle}`}
            {commentsCount > 0 && (
              <span className="bg-muted text-muted-foreground px-2 py-1 rounded-full text-xs">
                {commentsCount}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {/* Lista de comentários com scroll */}
          <div className="flex-1 overflow-y-auto pr-2">
            <TicketCommentsList 
              ticketId={ticketId} 
              onCommentsChange={handleCommentsChange}
              contextType={contextType}
            />
          </div>
          
          {/* Input para novo comentário fixo na parte inferior */}
          <div className="border-t pt-4">
            <TicketCommentInput 
              ticketId={ticketId} 
              onCommentAdded={handleCommentAdded}
              contextType={contextType}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}