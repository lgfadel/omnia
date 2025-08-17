import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { FIXTURE_USERS, UserRef, Attachment } from "@/data/fixtures"
import { Send, Paperclip, X } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useSupabaseUpload } from "@/hooks/useSupabaseUpload"

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

  return (
    <div className="flex gap-3">
      <Avatar className="w-8 h-8">
        <AvatarFallback className="text-xs">
          {userProfile?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'U'}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 space-y-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Adicione um comentário..."
          rows={3}
          disabled={loading}
        />
        
        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Anexos:</p>
            <div className="flex flex-wrap gap-2">
              {attachments.map(attachment => (
                <div key={attachment.id} className="flex items-center gap-2 bg-muted rounded-md px-2 py-1 text-xs">
                  <span className="truncate max-w-32">{attachment.name}</span>
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
              ))}
            </div>
          </div>
        )}
        
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">
              Pressione Ctrl+Enter para enviar
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