import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Send, Paperclip, X, Image } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useSupabaseUpload } from '@/hooks/useSupabaseUpload';
import { generateUserColor, getUserInitials } from '@/lib/userColors';
import { supabase } from '@/integrations/supabase/client';
import { ticketCommentsRepoSupabase } from '@/repositories/ticketCommentsRepo.supabase';
import { ataCommentsRepoSupabase, CreateAtaComment } from '@/repositories/ataCommentsRepo.supabase';
import { ticketAttachmentsRepoSupabase } from '@/repositories/ticketAttachmentsRepo.supabase';
import { usersRepoSupabase, type User as OmniaUser } from '@/repositories/usersRepo.supabase';
import { Attachment } from '@/data/types';
import { toast } from 'sonner';
import { logger } from '../../lib/logging';


interface TicketCommentInputProps {
  ticketId: string;
  onCommentAdded?: () => void;
  contextType?: 'ticket' | 'ata';
}

export const TicketCommentInput = ({ ticketId, onCommentAdded, contextType = 'ticket' }: TicketCommentInputProps) => {
  const { userProfile } = useAuth();
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeUsers, setActiveUsers] = useState<OmniaUser[]>([]);
  const [mentionState, setMentionState] = useState<{ start: number; end: number; query: string } | null>(null);
  const [mentionMap, setMentionMap] = useState<Map<string, string>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { uploadFile, uploading } = useSupabaseUpload();

  useEffect(() => {
    const load = async () => {
      try {
        const users = await usersRepoSupabase.getActiveUsers();
        setActiveUsers(users);
      } catch (error) {
        logger.error('Erro ao carregar usuários ativos para menções:', error);
      }
    };

    load();
  }, []);

  const getMentionState = (text: string, caret: number | null | undefined) => {
    const pos = typeof caret === 'number' ? caret : text.length;
    const before = text.slice(0, pos);
    const at = before.lastIndexOf('@');

    if (at === -1) return null;

    const prev = at > 0 ? before[at - 1] : ' ';
    if (!/\s/.test(prev)) return null;

    const afterAt = before.slice(at + 1);
    if (!afterAt) return { start: at, end: pos, query: '' };
    if (afterAt.startsWith('[')) return null;
    if (/\s/.test(afterAt)) return null;

    return { start: at, end: pos, query: afterAt };
  };

  const insertMention = (user: OmniaUser) => {
    if (!mentionState || !user.name) return;

    const before = body.slice(0, mentionState.start);
    const after = body.slice(mentionState.end);
    const displayToken = `@${user.name} `;
    const nextBody = `${before}${displayToken}${after}`;
    setBody(nextBody);
    setMentionMap((prev) => new Map(prev).set(user.name!, user.id));
    setMentionState(null);

    requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      textareaRef.current.focus();
      const caretPos = before.length + displayToken.length;
      textareaRef.current.setSelectionRange(caretPos, caretPos);
    });
  };

  const convertMentionsToIds = (text: string): string => {
    let result = text;
    mentionMap.forEach((userId, userName) => {
      const regex = new RegExp(`@${userName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=\\s|$)`, 'g');
      result = result.replace(regex, `@[${userId}]`);
    });
    return result;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if ((!body.trim() && attachments.length === 0) || !userProfile) return;

    try {
      setIsSubmitting(true);

      const commentBody = convertMentionsToIds(body.trim());
      
      // Create the comment first
      let newComment;
      if (contextType === 'ata') {
        const ataCommentData: CreateAtaComment = {
          ata_id: ticketId,
          body: commentBody,
          // author_id será definido automaticamente no repositório
        };
        newComment = await ataCommentsRepoSupabase.create(ataCommentData);
      } else {
        const ticketCommentData = {
          ticket_id: ticketId,
          body: commentBody,
          author_id: userProfile.id,
        };
        newComment = await ticketCommentsRepoSupabase.create(ticketCommentData);
      }

      try {
        await supabase.functions.invoke('notify-mentions', {
          body: {
            body: commentBody,
            ticket_id: contextType === 'ticket' ? ticketId : null,
            comment_id: contextType === 'ata' ? newComment.id : null,
            ticket_comment_id: contextType === 'ticket' ? newComment.id : null,
          },
        });
      } catch (error) {
        logger.error('Erro ao notificar menções:', error);
      }

      // Then create attachments linked to the comment
      for (const attachment of attachments) {
        await ticketAttachmentsRepoSupabase.create({
           ticket_id: ticketId,
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
      setMentionMap(new Map());
      onCommentAdded?.();
      toast.success('Comentário adicionado com sucesso');
    } catch (error) {
      logger.error('Erro ao adicionar comentário:', error);
      toast.error('Erro ao adicionar comentário');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setBody('');
    setAttachments([]);
    setMentionMap(new Map());
  };

  const renderHighlightedText = () => {
    if (!body) return null;
    const mentionNames = Array.from(mentionMap.keys());
    if (mentionNames.length === 0) return body;

    const pattern = mentionNames
      .map((name) => `@${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
      .join('|');
    const regex = new RegExp(`(${pattern})`, 'g');
    const parts = body.split(regex);

    return parts.map((part, i) => {
      const isMention = mentionNames.some((name) => part === `@${name}`);
      return isMention ? (
        <span key={i} className="text-blue-600 font-medium">{part}</span>
      ) : (
        <span key={i}>{part}</span>
      );
    });
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
          
          toast.success(`Imagem colada: ${filename}`);
          
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
      return;
    }
    
    // Handle Ctrl+A for select all - ensure it works
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      e.preventDefault();
      if (textareaRef.current) {
        textareaRef.current.select();
      }
      return;
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
            
            toast.success(`Imagem colada: ${filename}`);
            
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

  const mentionMatches = mentionState
    ? activeUsers
        .filter((u) => u.id !== userProfile.id)
        .filter((u) => u.name?.toLowerCase().includes(mentionState.query.toLowerCase()))
        .slice(0, 6)
    : [];

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
              onChange={(e) => {
                const next = e.target.value;
                setBody(next);
                setMentionState(getMentionState(next, e.target.selectionStart));
              }}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Escreva um comentário... (Ctrl+Enter para enviar, cole imagens diretamente)"
              className="min-h-[80px] resize-none border-0 p-0"
            />
            {mentionMap.size > 0 && (
              <div className="flex flex-wrap gap-1">
                {Array.from(mentionMap.keys()).map((name) => (
                  <span key={name} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    @{name}
                  </span>
                ))}
              </div>
            )}

            {mentionState && mentionMatches.length > 0 && (
              <div className="border rounded-md bg-white shadow-sm">
                {mentionMatches.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                    onClick={() => insertMention(u)}
                  >
                    @{u.name}
                  </button>
                ))}
              </div>
            )}
            
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