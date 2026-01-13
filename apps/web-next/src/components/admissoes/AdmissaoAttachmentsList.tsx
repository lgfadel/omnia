'use client';

import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { File, Trash2, Loader2, Upload, Download, FileText, Image, FileArchive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { admissaoAttachmentsRepoSupabase, type AdmissaoAttachment } from '@/repositories/admissaoAttachmentsRepo.supabase';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logging';

interface AdmissaoAttachmentsListProps {
  admissaoId: string;
}

const getFileIcon = (mimeType?: string) => {
  if (!mimeType) return File;
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.includes('pdf') || mimeType.includes('document')) return FileText;
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('archive')) return FileArchive;
  return File;
};

const formatFileSize = (sizeKb?: number) => {
  if (!sizeKb) return '';
  if (sizeKb < 1024) return `${sizeKb} KB`;
  return `${(sizeKb / 1024).toFixed(1)} MB`;
};

export function AdmissaoAttachmentsList({ admissaoId }: AdmissaoAttachmentsListProps) {
  const [attachments, setAttachments] = useState<AdmissaoAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [attachmentToDelete, setAttachmentToDelete] = useState<AdmissaoAttachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();

  useEffect(() => {
    loadAttachments();
  }, [admissaoId]);

  const loadAttachments = async () => {
    try {
      setLoading(true);
      const data = await admissaoAttachmentsRepoSupabase.listByAdmissao(admissaoId);
      setAttachments(data);
    } catch (error) {
      logger.error('Error loading attachments:', error);
      toast({ title: 'Erro', description: 'Erro ao carregar anexos', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setUploading(true);
      for (const file of Array.from(files)) {
        const attachment = await admissaoAttachmentsRepoSupabase.uploadFile(admissaoId, file);
        setAttachments(prev => [attachment, ...prev]);
      }
      toast({ title: 'Sucesso', description: 'Arquivo(s) enviado(s) com sucesso' });
    } catch (error) {
      logger.error('Error uploading file:', error);
      toast({ title: 'Erro', description: 'Erro ao enviar arquivo', variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteClick = (attachment: AdmissaoAttachment) => {
    setAttachmentToDelete(attachment);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!attachmentToDelete) return;

    try {
      await admissaoAttachmentsRepoSupabase.remove(attachmentToDelete.id);
      setAttachments(attachments.filter(a => a.id !== attachmentToDelete.id));
      toast({ title: 'Sucesso', description: 'Anexo removido' });
    } catch (error) {
      logger.error('Error deleting attachment:', error);
      toast({ title: 'Erro', description: 'Erro ao remover anexo', variant: 'destructive' });
    } finally {
      setDeleteDialogOpen(false);
      setAttachmentToDelete(null);
    }
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
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Anexos ({attachments.length})</CardTitle>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileChange}
            className="hidden"
            accept="*/*"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Enviar Arquivo
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum anexo ainda.
          </p>
        ) : (
          <div className="space-y-2">
            {attachments.map((attachment) => {
              const FileIcon = getFileIcon(attachment.mimeType);
              return (
                <div
                  key={attachment.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileIcon className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{attachment.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(attachment.sizeKb)}
                        {attachment.sizeKb && ' • '}
                        {format(attachment.createdAt, 'dd/MM/yyyy', { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      asChild
                    >
                      <a href={attachment.url} target="_blank" rel="noopener noreferrer" download>
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleDeleteClick(attachment)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir anexo?</AlertDialogTitle>
            <AlertDialogDescription>
              O arquivo &quot;{attachmentToDelete?.name}&quot; será removido permanentemente.
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
