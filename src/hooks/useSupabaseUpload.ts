import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from '@/components/ui/use-toast'
import { Attachment } from '@/data/types'

export function useSupabaseUpload() {
  const [uploading, setUploading] = useState(false)

  const uploadFile = async (file: File): Promise<Attachment | null> => {
    try {
      setUploading(true)
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast({
          title: 'Erro de autenticação',
          description: 'Você precisa estar logado para enviar arquivos.',
          variant: 'destructive',
        })
        return null
      }

      // Generate unique filename with user folder structure
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
      
      // Upload file to Supabase Storage
      const { data, error } = await supabase.storage
        .from('attachments')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) {
        console.error('Upload error:', error)
        toast({
          title: 'Erro no upload',
          description: 'Não foi possível enviar o arquivo. Tente novamente.',
          variant: 'destructive',
        })
        return null
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('attachments')
        .getPublicUrl(data.path)

      return {
        id: `${Date.now()}-${Math.random()}`,
        name: file.name,
        url: publicUrl,
        sizeKB: Math.round(file.size / 1024),
        mime: file.type || 'application/octet-stream',
        createdAt: new Date().toISOString()
      }
    } catch (error) {
      console.error('Upload error:', error)
      toast({
        title: 'Erro no upload',
        description: 'Não foi possível enviar o arquivo. Tente novamente.',
        variant: 'destructive',
      })
      return null
    } finally {
      setUploading(false)
    }
  }

  const uploadFiles = async (files: File[]): Promise<Attachment[]> => {
    setUploading(true)
    const uploadPromises = files.map(file => uploadFile(file))
    const results = await Promise.all(uploadPromises)
    setUploading(false)
    return results.filter((result): result is Attachment => result !== null)
  }

  return {
    uploadFile,
    uploadFiles,
    uploading
  }
}