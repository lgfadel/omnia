import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TicketCommentsList } from '@/components/tickets/TicketCommentsList';
import { TicketCommentInput } from '@/components/tickets/TicketCommentInput';
import { MessageCircle } from 'lucide-react';
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

  // A lista já busca os comentários a cada abertura, adição, edição e exclusão;
  // ela informa o total e o modal só o exibe e repassa. Antes o modal buscava a
  // mesma lista por conta própria — cinco vezes a cada comentário adicionado.
  const handleCountChange = useCallback((count: number) => {
    setCommentsCount(count);
    onCommentCountChange?.(count);
  }, [onCommentCountChange]);

  // Remontar a lista é o que a faz recarregar com o comentário novo.
  const handleCommentAdded = async () => {
    setRefreshKey(prev => prev + 1);
    // Não fecha o modal após adicionar comentário para permitir adicionar mais
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
              key={refreshKey}
              ticketId={ticketId} 
              onCountChange={handleCountChange}
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