import { supabase } from '@/integrations/supabase/client';
import { logger } from '../lib/logging';

export interface AdmissaoAttachment {
  id: string;
  admissaoId: string;
  name: string;
  url: string;
  sizeKb?: number;
  mimeType?: string;
  uploadedBy?: string;
  createdAt: Date;
}

function transformAttachmentFromDB(dbAttachment: any): AdmissaoAttachment {
  return {
    id: dbAttachment.id,
    admissaoId: dbAttachment.admissao_id,
    name: dbAttachment.name,
    url: dbAttachment.url,
    sizeKb: dbAttachment.size_kb || undefined,
    mimeType: dbAttachment.mime_type || undefined,
    uploadedBy: dbAttachment.uploaded_by || undefined,
    createdAt: new Date(dbAttachment.created_at),
  };
}

export const admissaoAttachmentsRepoSupabase = {
  async listByAdmissao(admissaoId: string): Promise<AdmissaoAttachment[]> {
    logger.debug(`Loading attachments for admissão: ${admissaoId}`)
    
    const { data, error } = await supabase
      .from('omnia_admissao_attachments')
      .select('*')
      .eq('admissao_id', admissaoId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Erro ao buscar anexos de admissão:', error);
      throw error;
    }

    return data?.map(transformAttachmentFromDB) || [];
  },

  async create(attachment: Omit<AdmissaoAttachment, 'id' | 'createdAt'>): Promise<AdmissaoAttachment> {
    logger.debug(`Creating attachment for admissão: ${attachment.admissaoId}`)
    
    const { data, error } = await supabase
      .from('omnia_admissao_attachments')
      .insert({
        admissao_id: attachment.admissaoId,
        name: attachment.name,
        url: attachment.url,
        size_kb: attachment.sizeKb || null,
        mime_type: attachment.mimeType || null,
        uploaded_by: attachment.uploadedBy || null,
      })
      .select()
      .single();

    if (error) {
      logger.error('Erro ao criar anexo de admissão:', error);
      throw error;
    }

    return transformAttachmentFromDB(data);
  },

  async remove(id: string): Promise<boolean> {
    logger.debug(`Removing attachment: ${id}`)
    
    // First get the attachment to delete from storage
    const { data: attachment } = await supabase
      .from('omnia_admissao_attachments')
      .select('url')
      .eq('id', id)
      .single() as { data: { url: string } | null };

    if ((attachment as any)?.url) {
      // Extract the path from the URL and delete from storage
      try {
        const url = new URL((attachment as any).url);
        const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/admissoes\/(.+)/);
        if (pathMatch) {
          const filePath = decodeURIComponent(pathMatch[1]);
          await supabase.storage.from('admissoes').remove([filePath]);
        }
      } catch (storageError) {
        logger.warn('Erro ao deletar arquivo do storage:', storageError);
      }
    }

    const { error } = await supabase
      .from('omnia_admissao_attachments')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Erro ao deletar anexo de admissão:', error);
      throw error;
    }

    return true;
  },

  async uploadFile(admissaoId: string, file: File): Promise<AdmissaoAttachment> {
    logger.debug(`Uploading file for admissão: ${admissaoId}`)
    
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    const fileName = `${admissaoId}/${Date.now()}_${file.name}`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('admissoes')
      .upload(fileName, file);

    if (uploadError) {
      logger.error('Erro ao fazer upload do arquivo:', uploadError);
      throw uploadError;
    }

    const { data: publicUrlData } = supabase.storage
      .from('admissoes')
      .getPublicUrl(uploadData.path);

    const attachment = await this.create({
      admissaoId,
      name: file.name,
      url: publicUrlData.publicUrl,
      sizeKb: Math.round(file.size / 1024),
      mimeType: file.type,
      uploadedBy: userId,
    });

    return attachment;
  }
};
