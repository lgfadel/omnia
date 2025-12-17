import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Send, Paperclip, X } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useSupabaseUpload } from '@/hooks/useSupabaseUpload';
import { generateUserColor, getUserInitials } from '@/lib/userColors';
import { crmCommentsRepoSupabase } from '@/repositories/crmCommentsRepo.supabase';
import { crmAttachmentsRepoSupabase } from '@/repositories/crmAttachmentsRepo.supabase';
import { Attachment } from '@/data/types';
import { toast } from '@/hooks/use-toast'
import { logger } from '../../lib/logging';


interface CrmCommentInputProps {
  leadId: string;
  onCommentAdded?: () => void;
}

export const CrmCommentInput = ({ leadId, onCommentAdded }: CrmCommentInputProps) => {
  const { userProfile } = useAuth();
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { uploadFile, uploading } = useSupabaseUpload();

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if ((!body.trim() && attachments.length === 0) || !userProfile) return;

    try {
      setIsSubmitting(true);
      
      // Create the comment first
      const crmCommentData = {
        lead_id: leadId,
        body: body.trim(),
        author_id: userProfile.id,
      };
      const newComment = await crmCommentsRepoSupabase.create(crmCommentData);

      // Then create attachments linked to the comment
      for (const attachment of attachments) {
        await crmAttachmentsRepoSupabase.create({
           lead_id: leadId,
           comment_id: newComment.id,
           name: attachment.name,
           url: attachment.url,
           mime_type: attachment.mime || null,
           size_kb: attachment.sizeKB || null,
           uploaded_by: userProfile.id,
         });
      }

      setBody('');
      setAttachments([]);
      onCommentAdded?.();
      toast({
        title: 'Sucesso',
        description: 'Comentário adicionado com sucesso',
      })
    } catch (error) {
      logger.error('Erro ao adicionar comentário:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao adicionar comentário',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setBody('');
    setAttachments([]);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    for (const file of files) {
      const uploadedAttachment = await uploadFile(file);
      if (uploadedAttachment) {
        setAttachments(prev => [...prev, uploadedAttachment]);
      }
    }
    
    // Clear the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(att => att.id !== id));
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        
        const file = item.getAsFile();
        if (file) {
          // Generate a meaningful filename for the pasted image
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const extension = file.type.split('/')[1] || 'png';
          const filename = `clipboard-image-${timestamp}.${extension}`;
          
          // Create a new File object with the proper name
          const namedFile = new File([file], filename, { type: file.type });
          
          toast({
            title: 'Imagem colada',
            description: filename,
          })
          
          const uploadedAttachment = await uploadFile(namedFile);
          if (uploadedAttachment) {
            setAttachments(prev => [...prev, uploadedAttachment]);
          }
        }
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle Ctrl+Enter or Cmd+Enter for submit
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Global paste listener for images
  useEffect(() => {
    const handleGlobalPaste = async (e: ClipboardEvent) => {
      // Only handle if we're not already focused on an input/textarea
      const activeElement = document.activeElement;
      const isInputFocused = activeElement?.tagName === 'INPUT' || 
                            activeElement?.tagName === 'TEXTAREA' ||
                            (activeElement as HTMLElement)?.contentEditable === 'true';
      
      if (isInputFocused) return;
      
      const items = Array.from(e.clipboardData?.items || []);
      
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          
          const file = item.getAsFile();
          if (file) {
            // Generate a meaningful filename for the pasted image
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const extension = file.type.split('/')[1] || 'png';
            const filename = `clipboard-image-${timestamp}.${extension}`;
            
            // Create a new File object with the proper name
            const namedFile = new File([file], filename, { type: file.type });
            
            toast({
              title: 'Imagem colada',
              description: filename,
            })
            
            const uploadedAttachment = await uploadFile(namedFile);
            if (uploadedAttachment) {
              setAttachments(prev => [...prev, uploadedAttachment]);
            }
          }
        }
      }
    };

    document.addEventListener('paste', handleGlobalPaste);
    return () => document.removeEventListener('paste', handleGlobalPaste);
  }, [uploadFile]);

  if (!userProfile) return null;

  const userColor = userProfile.color || generateUserColor(userProfile.id);
  const userInitials = getUserInitials(userProfile.name || userProfile.email);
  const hasContent = body.trim() || attachments.length > 0;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex gap-3">
          <Avatar className="h-8 w-8 flex-shrink-0">
            <AvatarFallback 
              className="text-xs font-medium text-white"
              style={{ backgroundColor: userColor }}
            >
              {userInitials}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 space-y-3">
            <Textarea
              ref={textareaRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Escreva um comentário... (Ctrl+Enter para enviar, cole imagens diretamente)"
              className="min-h-[80px] resize-none border-0 p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            
            {/* Attachments Display */}
            {attachments.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {attachments.map((attachment) => (
                  <div key={attachment.id} className="relative group">
                    {attachment.mime?.startsWith('image/') ? (
                      <div className="relative aspect-square rounded-lg overflow-hidden border">
                        <img
                          src={attachment.url}
                          alt={attachment.name}
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={() => removeAttachment(attachment.id)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 truncate">
                          {attachment.name}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 p-2 border rounded-lg bg-gray-50">
                        <Paperclip className="h-4 w-4 text-gray-500" />
                        <span className="text-sm truncate flex-1">{attachment.name}</span>
                        <button
                          onClick={() => removeAttachment(attachment.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {/* Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  accept="*/*"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="h-8 px-2"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                {uploading && (
                  <span className="text-sm text-gray-500">Enviando arquivo...</span>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                {hasContent && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleCancel}
                    disabled={isSubmitting}
                  >
                    Cancelar
                  </Button>
                )}
                <Button
                  onClick={() => handleSubmit()}
                  disabled={!hasContent || isSubmitting}
                  size="sm"
                  className="h-8"
                >
                  {isSubmitting ? (
                    'Enviando...'
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-1" />
                      Comentar
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};