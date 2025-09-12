import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, X, FileIcon } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useSupabaseUpload } from '@/hooks/useSupabaseUpload';
import { ticketAttachmentsRepoSupabase } from '@/repositories/ticketAttachmentsRepo.supabase';
import { toast } from 'sonner';

interface TicketFileUploaderProps {
  ticketId: string;
  onFileUploaded?: () => void;
}

export const TicketFileUploader = ({ ticketId, onFileUploaded }: TicketFileUploaderProps) => {
  const { userProfile } = useAuth();
  const { uploadFiles, uploading } = useSupabaseUpload();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(files);
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0 || !userProfile) return;

    try {
      const uploadedAttachments = await uploadFiles(selectedFiles);
      
      // Salvar os anexos na nova tabela de ticket attachments
      for (const attachment of uploadedAttachments) {
        await ticketAttachmentsRepoSupabase.create({
          ticket_id: ticketId,
          name: attachment.name,
          url: attachment.url,
          mime_type: attachment.mime,
          size_kb: attachment.sizeKB,
          uploaded_by: userProfile.id,
        });
      }

      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onFileUploaded?.();
      toast.success(`${uploadedAttachments.length} arquivo(s) enviado(s) com sucesso`);
    } catch (error) {
      console.error('Erro ao fazer upload dos arquivos:', error);
      toast.error('Erro ao fazer upload dos arquivos');
    }
  };

  const formatFileSize = (bytes: number) => {
    return Math.round(bytes / 1024);
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload">
              <Button variant="outline" className="cursor-pointer" asChild>
                <span>
                  <Upload className="h-4 w-4 mr-2" />
                  Selecionar Arquivos
                </span>
              </Button>
            </label>
            {selectedFiles.length > 0 && (
              <Button
                onClick={handleUpload}
                disabled={uploading}
              >
                {uploading ? 'Enviando...' : `Enviar ${selectedFiles.length} arquivo(s)`}
              </Button>
            )}
          </div>

          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Arquivos selecionados:</h4>
              {selectedFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                  <div className="flex items-center gap-2">
                    <FileIcon className="h-4 w-4" />
                    <span className="text-sm">{file.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({formatFileSize(file.size)} KB)
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveFile(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};