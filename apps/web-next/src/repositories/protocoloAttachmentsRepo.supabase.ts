import { supabase } from '@/integrations/supabase/client';
import { logger } from '../lib/logging';

export interface ProtocoloAttachment {
  id: string;
  protocoloId: string;
  name: string;
  url: string;
  sizeKb?: number;
  mimeType?: string;
  uploadedBy?: string;
  createdAt: Date;
}

function transformAttachmentFromDB(dbAttachment: any): ProtocoloAttachment {
  return {
    id: dbAttachment.id,
    protocoloId: dbAttachment.protocolo_id,
    name: dbAttachment.name,
    url: dbAttachment.url,
    sizeKb: dbAttachment.size_kb || undefined,
    mimeType: dbAttachment.mime_type || undefined,
    uploadedBy: dbAttachment.uploaded_by || undefined,
    createdAt: dbAttachment.created_at ? new Date(dbAttachment.created_at) : new Date(),
  };
}

// Type assertion para tabela não tipada ainda no Supabase
const protocoloAttachmentsTable = () => supabase.from('omnia_protocolo_attachments' as any)

export const protocoloAttachmentsRepoSupabase = {
  async listByProtocolo(protocoloId: string): Promise<ProtocoloAttachment[]> {
    logger.debug(`Loading attachments for protocolo: ${protocoloId}`)
    
    const { data, error } = await protocoloAttachmentsTable()
      .select('*')
      .eq('protocolo_id', protocoloId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Erro ao buscar anexos de protocolo:', error);
      throw error;
    }

    return data?.map(transformAttachmentFromDB) || [];
  },

  async create(attachment: Omit<ProtocoloAttachment, 'id' | 'createdAt'>): Promise<ProtocoloAttachment> {
    logger.debug(`Creating attachment for protocolo: ${attachment.protocoloId}`)
    
    const insertData = {
      protocolo_id: attachment.protocoloId,
      name: attachment.name,
      url: attachment.url,
      size_kb: attachment.sizeKb || null,
      mime_type: attachment.mimeType || null,
      uploaded_by: attachment.uploadedBy || null,
    };
    
    logger.debug('Insert data:', insertData);
    
    const { data, error } = await protocoloAttachmentsTable()
      .insert(insertData)
      .select()
      .single();

    if (error) {
      logger.error('Erro ao criar anexo de protocolo:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        error: error
      });
      throw new Error(`Falha ao criar anexo: ${error.message || 'Erro desconhecido'}`);
    }

    if (!data) {
      throw new Error('Criação de anexo não retornou dados');
    }

    return transformAttachmentFromDB(data);
  },

  async remove(id: string): Promise<boolean> {
    logger.debug(`Removing attachment: ${id}`)
    
    // First get the attachment to delete from storage
    const { data: attachment } = await protocoloAttachmentsTable()
      .select('url')
      .eq('id', id)
      .single() as { data: { url: string } | null };

    if (attachment?.url) {
      // Extract the path from the URL and delete from storage
      try {
        const url = new URL(attachment.url);
        const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/protocolos\/(.+)/);
        if (pathMatch) {
          const filePath = decodeURIComponent(pathMatch[1]);
          await supabase.storage.from('protocolos').remove([filePath]);
        }
      } catch (storageError) {
        logger.warn('Erro ao deletar arquivo do storage:', storageError);
      }
    }

    const { error } = await protocoloAttachmentsTable()
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Erro ao deletar anexo de protocolo:', error);
      throw error;
    }

    return true;
  },

  async uploadFile(protocoloId: string, file: File): Promise<ProtocoloAttachment> {
    logger.debug(`Uploading file for protocolo: ${protocoloId}`, { fileName: file.name, fileSize: file.size })
    
    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError) {
      logger.error('Erro ao obter usuário autenticado:', authError);
      throw new Error('Usuário não autenticado');
    }
    
    const authUserId = userData.user?.id;
    if (!authUserId) {
      throw new Error('ID do usuário autenticado não encontrado');
    }

    // Buscar o ID do usuário na tabela omnia_users
    const { data: omniaUser, error: userError } = await supabase
      .from('omnia_users')
      .select('id')
      .eq('auth_user_id', authUserId)
      .single();

    if (userError || !omniaUser) {
      logger.error('Erro ao buscar usuário Omnia:', userError);
      throw new Error('Usuário não encontrado na tabela omnia_users');
    }

    const fileName = `${protocoloId}/${Date.now()}_${file.name}`;
    logger.debug(`Uploading to storage path: ${fileName}`);
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('protocolos')
      .upload(fileName, file);

    if (uploadError) {
      logger.error('Erro ao fazer upload do arquivo:', {
        message: uploadError.message,
        statusCode: uploadError.statusCode,
        error: uploadError
      });
      throw new Error(`Falha no upload: ${uploadError.message || 'Erro desconhecido'}`);
    }

    if (!uploadData) {
      throw new Error('Upload não retornou dados');
    }

    logger.debug(`Upload successful, getting public URL for: ${uploadData.path}`);

    const { data: publicUrlData } = supabase.storage
      .from('protocolos')
      .getPublicUrl(uploadData.path);

    const attachment = await this.create({
      protocoloId,
      name: file.name,
      url: publicUrlData.publicUrl,
      sizeKb: Math.round(file.size / 1024),
      mimeType: file.type,
      uploadedBy: omniaUser.id,
    });

    logger.debug(`Attachment created successfully:`, { id: attachment.id });
    return attachment;
  }
};
