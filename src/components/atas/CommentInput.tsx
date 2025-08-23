import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { FIXTURE_USERS, UserRef, Attachment } from "@/data/fixtures"
import { Send, Paperclip, X, Image } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useSupabaseUpload } from "@/hooks/useSupabaseUpload"
import { generateUserColor, getUserInitials } from "@/lib/userColors"
import { toast } from "@/components/ui/use-toast"

interface CommentInputProps {
  onSubmit: (body: string, attachments?: Attachment[]) => void
  loading?: boolean
}

// Mock current user - in real app this would come from auth context
export function CommentInput({ onSubmit, loading }: CommentInputProps) {
  const { userProfile } = useAuth()
  const [body, setBody] = useState("")
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { uploadFile, uploading } = useSupabaseUpload()

  const handleSubmit = () => {
    if (body.trim() || attachments.length > 0) {
      onSubmit(body, attachments)
      setBody("")
      setAttachments([])
    }
  }

  const handleCancel = () => {
    setBody("")
    setAttachments([])
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    
    for (const file of files) {
      const uploadedAttachment = await uploadFile(file)
      if (uploadedAttachment) {
        setAttachments(prev => [...prev, uploadedAttachment])
      }
    }
    
    // Clear the input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(att => att.id !== id))
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items)
    
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        
        const file = item.getAsFile()
        if (file) {
          // Generate a meaningful filename for the pasted image
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
          const extension = file.type.split('/')[1] || 'png'
          const filename = `clipboard-image-${timestamp}.${extension}`
          
          // Create a new File object with the proper name
          const namedFile = new File([file], filename, { type: file.type })
          
          toast({
            title: 'Imagem colada',
            description: `Enviando imagem do clipboard: ${filename}`,
          })
          
          const uploadedAttachment = await uploadFile(namedFile)
          if (uploadedAttachment) {
            setAttachments(prev => [...prev, uploadedAttachment])
          }
        }
      }
    }
  }

  // Focus management for paste events
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      const handleGlobalPaste = (e: ClipboardEvent) => {
        // Only handle paste if the textarea is focused or if no other input is focused
        const activeElement = document.activeElement
        if (activeElement === textarea || 
            (!activeElement || activeElement.tagName === 'BODY')) {
          // Convert to React event format
          const reactEvent = {
            clipboardData: e.clipboardData,
            preventDefault: () => e.preventDefault()
          } as React.ClipboardEvent
          
          handlePaste(reactEvent)
        }
      }
      
      document.addEventListener('paste', handleGlobalPaste)
      return () => document.removeEventListener('paste', handleGlobalPaste)
    }
  }, [])

  return (
    <div className="flex gap-3">
      <Avatar className="w-8 h-8">
        <AvatarFallback 
          className="text-xs text-white font-medium"
          style={{ 
            backgroundColor: userProfile?.color && typeof userProfile.color === 'string' && userProfile.color.trim() !== ''
              ? userProfile.color
              : generateUserColor(userProfile?.id, userProfile?.name)
          }}
        >
          {userProfile?.name ? getUserInitials(userProfile.name) : 'U'}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 space-y-2">
        <Textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyPress}
          onPaste={handlePaste}
          placeholder="Adicione um comentário... (Ctrl+V para colar imagens)"
          rows={3}
          disabled={loading}
        />
        
        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Anexos:</p>
            <div className="flex flex-wrap gap-2">
              {attachments.map(attachment => {
                const isClipboardImage = attachment.name.startsWith('clipboard-image-')
                const isImage = attachment.mime?.startsWith('image/')
                
                return (
                  <div key={attachment.id} className="flex items-center gap-2 bg-muted rounded-md px-2 py-1 text-xs">
                    {isImage && (
                      <Image className="w-3 h-3 text-blue-500" />
                    )}
                    {isClipboardImage && (
                      <span className="text-blue-600 font-medium">📋</span>
                    )}
                    <span className="truncate max-w-32" title={attachment.name}>
                      {isClipboardImage ? 'Imagem colada' : attachment.name}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-4 w-4 p-0"
                      onClick={() => removeAttachment(attachment.id)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">
              Ctrl+Enter para enviar • Ctrl+V para colar imagens
            </p>
            
            <div className="relative">
              <Input
                ref={fileInputRef}
                type="file"
                multiple
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={handleFileUpload}
                disabled={loading || uploading}
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                disabled={loading || uploading}
              >
                <Paperclip className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              onClick={handleCancel}
              disabled={loading || (!body.trim() && attachments.length === 0)}
              size="sm"
              variant="outline"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={(!body.trim() && attachments.length === 0) || loading || uploading}
              size="sm"
            >
              <Send className="w-4 h-4 mr-2" />
              {(loading || uploading) ? "Enviando..." : "Comentar"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}