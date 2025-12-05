import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Trash2, Download, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/components/auth/AuthProvider';
import { ticketAttachmentsRepoSupabase, type TicketAttachment } from '@/repositories/ticketAttachmentsRepo.supabase';
import { ImagePreviewModal } from '@/components/ui/image-preview-modal';
import { toast } from 'sonner';
import { logger } from '../../lib/logging';


interface TicketAttachmentsListProps {
  ticketId: string;
}

export const TicketAttachmentsList = ({ ticketId }: TicketAttachmentsListProps) => {
  const { userProfile } = useAuth();
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const loadAttachments = useCallback(async () => {
    try {
      setLoading(true);
      const attachmentsData = await ticketAttachmentsRepoSupabase.list(ticketId);
      setAttachments(attachmentsData);
    } catch (error) {
      logger.error('Erro ao carregar anexos:', error);
      toast.error('Erro ao carregar anexos');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    if (ticketId) {
      loadAttachments();
    }
  }, [ticketId, loadAttachments]);

  const handleDeleteAttachment = async (attachmentId: string) => {
    try {
      await ticketAttachmentsRepoSupabase.remove(attachmentId);
      await loadAttachments();
      toast.success('Anexo excluído com sucesso');
    } catch (error) {
      logger.error('Erro ao excluir anexo:', error);
      toast.error('Erro ao excluir anexo');
    }
  };

  const handleDownload = (attachment: TicketAttachment) => {
    window.open(attachment.url, '_blank');
  };

  const isImage = (mimeType: string | null) => {
    return mimeType?.startsWith('image/') || false;
  };

  if (loading) {
    return <div>Carregando anexos...</div>;
  }

  if (attachments.length === 0) {
    return <div className="text-muted-foreground">Nenhum anexo encontrado.</div>;
  }

  return (
    <>
      <div className="space-y-4">
        {attachments.map((attachment) => (
          <Card key={attachment.id}>
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <div className="flex-1">
                  <h4 className="font-medium">{attachment.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(attachment.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", {
                      locale: ptBR,
                    })}
                    {attachment.size_kb && ` • ${attachment.size_kb} KB`}
                  </p>
                </div>
                <div className="flex gap-2">
                  {isImage(attachment.mime_type) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedImage(attachment.url)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(attachment)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  {(userProfile?.id === attachment.uploaded_by || userProfile?.roles?.includes('ADMIN')) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteAttachment(attachment.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedImage && (
        <ImagePreviewModal
          imageUrl={selectedImage}
          imageName="Anexo"
          isOpen={!!selectedImage}
          onClose={() => setSelectedImage(null)}
        />
      )}
    </>
  );
};