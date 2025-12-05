import { supabase } from "@/integrations/supabase/client"
import { logger } from '@/lib/logging'
import { Ata, Comment, Attachment, Status, UserRef, Role } from "@/data/types"

// Database types for type safety
interface DbAta {
  id: string;
  code?: string | null;
  title: string;
  description?: string | null;
  meeting_date?: string | null;
  created_at: string;
  updated_at: string;
  secretary_id?: string | null;
  responsible_id?: string | null;
  status_id: string;
  condominium_id?: string | null;
  ticket?: string | null;
  tags?: string[] | null;
  comment_count?: number | null;
  omnia_attachments?: DbAttachment[] | null;
  omnia_comments?: DbComment[] | null;
  omnia_users?: DbUser | DbUser[] | null;
  responsible_user?: DbUser | null;
}

interface DbAttachment {
  id: string;
  name: string;
  url: string;
  size_kb?: number | null;
  mime_type?: string | null;
  created_at: string;
  comment_id?: string | null;
  ata_id?: string | null;
}

interface DbComment {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  author_user?: DbUser | null;
  ata_id?: string | null;
}

interface DbUser {
  id: string;
  name: string;
  avatar_url?: string | null;
  color?: string | null;
  roles?: string[] | null;
}

interface DbStatus {
  id: string;
  name: string;
  color: string;
  order_position: number;
  is_default?: boolean;
}

interface DbAtaUpdate {
  title?: string;
  description?: string;
  meeting_date?: string;
  secretary_id?: string;
  responsible_id?: string;
  status_id?: string;
  condominium_id?: string;
  ticket?: string;
  tags?: string[];
}

interface SupabaseUntyped {
  from: (table: string) => {
    select: (columns?: string) => any;
    insert: (data: any) => any;
    update: (data: any) => any;
    delete: () => any;
  };
}

// Use existing supabase client with type casting for untyped tables
const supabaseUntyped = supabase as SupabaseUntyped

const normalizeRoles = (roles?: string[] | null): Role[] => {
  if (!roles) return []
  return roles.map((role) => role as Role)
}

const mapDbUserToUserRef = (user?: DbUser | null): UserRef | undefined => {
  if (!user) return undefined

  return {
    id: user.id,
    name: user.name,
    email: '',
    roles: normalizeRoles(user.roles),
    avatarUrl: user.avatar_url ?? undefined,
    color: user.color ?? undefined,
  }
}

const mapDbAttachment = (att: DbAttachment): Attachment => ({
  id: att.id,
  name: att.name,
  url: att.url,
  sizeKB: att.size_kb ?? undefined,
  mime: att.mime_type ?? undefined,
  createdAt: att.created_at || new Date().toISOString()
})

// Transform database record to Ata type
const transformAtaFromDB = (dbAta: DbAta, statuses: Status[]): Ata => {
  const secretaryUser = Array.isArray(dbAta.omnia_users)
    ? dbAta.omnia_users[0]
    : dbAta.omnia_users
  
  // Group attachments by comment_id for quick lookup
  const attachmentsByCommentId: Record<string, DbAttachment[]> = {}
  ;(dbAta.omnia_attachments || []).forEach((att: DbAttachment) => {
    if (att.comment_id) {
      if (!attachmentsByCommentId[att.comment_id]) attachmentsByCommentId[att.comment_id] = []
      attachmentsByCommentId[att.comment_id].push(att)
    }
  })

  // Transform comments with proper author handling and mapped attachments
  const transformedComments: Comment[] = (dbAta.omnia_comments || []).map((comment: DbComment) => {
    const rawAttachments = attachmentsByCommentId[comment.id] || []
    const mappedAttachments = rawAttachments.map(mapDbAttachment)

    const fallbackAuthor: UserRef = {
      id: comment.author_id,
      name: 'Usuário não encontrado',
      email: '',
      roles: [],
      avatarUrl: undefined,
      color: undefined,
    }

    return {
      id: comment.id,
      body: comment.body,
      createdAt: comment.created_at,
      author: mapDbUserToUserRef(comment.author_user) ?? fallbackAuthor,
      attachments: mappedAttachments
    }
  })
  
  return {
    id: dbAta.id,
    code: dbAta.code ?? undefined,
    title: dbAta.title,
    description: dbAta.description ?? undefined,
    meetingDate: dbAta.meeting_date ?? undefined,
    createdAt: dbAta.created_at,
    updatedAt: dbAta.updated_at,
    secretary: mapDbUserToUserRef(secretaryUser),
    responsible: mapDbUserToUserRef(dbAta.responsible_user),
    statusId: dbAta.status_id,
    condominiumId: dbAta.condominium_id ?? undefined,
    ticket: dbAta.ticket ?? undefined,
    tags: dbAta.tags ?? [],
    commentCount: dbAta.comment_count ?? 0,
    // Transform attachments
    attachments: (dbAta.omnia_attachments || []).map(mapDbAttachment),
    comments: transformedComments
  }
}

// Transform database record to Status type
const transformStatusFromDB = (dbStatus: DbStatus): Status => ({
  id: dbStatus.id,
  name: dbStatus.name,
  color: dbStatus.color,
  order: dbStatus.order_position,
  isDefault: dbStatus.is_default
})

export const atasRepoSupabase = {
  async list(search?: string, statusFilter?: string[]): Promise<Ata[]> {
    // First get statuses for transformation
    const { data: statusesData } = await supabaseUntyped
      .from('omnia_statuses')
      .select('*')
      .order('order_position')

    const statuses = statusesData?.map(transformStatusFromDB) || []

    let query = supabase
      .from('omnia_atas')
      .select(`
        *,
        omnia_users:omnia_users!omnia_atas_secretary_id_fkey (id, name, roles, avatar_url, color),
        responsible_user:omnia_users!omnia_atas_responsible_id_fkey (id, name, roles, avatar_url, color)
      `)
      .order('created_at', { ascending: false })

    if (search) {
      query = query.or(`title.ilike.%${search}%,code.ilike.%${search}%,description.ilike.%${search}%`)
    }

    if (statusFilter && statusFilter.length > 0) {
      query = query.in('status_id', statusFilter)
    }

    const { data, error } = await query

    if (error) throw error

    // Get attachments and comments separately
    const ataIds = data?.map(ata => ata.id) || []
    let attachments: DbAttachment[] = []
    let comments: DbComment[] = []
    
    if (ataIds.length > 0) {
      const { data: attachmentsData } = await supabaseUntyped
        .from('omnia_attachments')
        .select('*')
        .in('ata_id', ataIds)
      
      const { data: commentsData } = await supabaseUntyped
        .from('omnia_comments')
        .select(`
          *,
          author_user:omnia_users!omnia_comments_author_id_fkey (id, name, roles, avatar_url, color)
        `)
        .in('ata_id', ataIds)
      
      attachments = attachmentsData || []
      comments = commentsData || []
    }

    return data?.map(ata => {
      const ataAttachments = attachments.filter(att => att.ata_id === ata.id)
      const ataComments = comments.filter(comm => comm.ata_id === ata.id)
      return transformAtaFromDB({ ...ata, omnia_attachments: ataAttachments, omnia_comments: ataComments }, statuses)
    }) || []
  },

  async getById(id: string): Promise<Ata | null> {
    // First get statuses for transformation
    const { data: statusesData } = await supabaseUntyped
      .from('omnia_statuses')
      .select('*')
      .order('order_position')

    const statuses = statusesData?.map(transformStatusFromDB) || []

    const { data, error } = await supabase
      .from('omnia_atas')
      .select(`
        *,
        omnia_users:omnia_users!omnia_atas_secretary_id_fkey (id, name, roles, avatar_url, color),
        responsible_user:omnia_users!omnia_atas_responsible_id_fkey (id, name, roles, avatar_url, color)
      `)
      .eq('id', id)
      .maybeSingle()

    if (error) {
      console.error('AtasRepo: Error getting ata:', error)
      throw error
    }

    if (!data) {
      logger.debug('AtasRepo: No ata found with id:', id)
      return null
    }

    // Get attachments and comments separately
    const { data: attachmentsData } = await supabaseUntyped
      .from('omnia_attachments')
      .select('*')
      .eq('ata_id', data.id)
    
    const { data: commentsData } = await supabaseUntyped
      .from('omnia_comments')
      .select(`
        *,
        author_user:omnia_users!omnia_comments_author_id_fkey (id, name, roles, avatar_url, color)
      `)
      .eq('ata_id', data.id)

    logger.debug('AtasRepo: Found ata:', data)
    return transformAtaFromDB({
      ...data,
      omnia_attachments: attachmentsData || [],
      omnia_comments: commentsData || []
    }, statuses)
  },

  async create(data: Omit<Ata, 'id' | 'createdAt' | 'updatedAt' | 'commentCount'>): Promise<Ata> {
    // Get next code number
    const { data: lastAta } = await supabase
      .from('omnia_atas')
      .select('code')
      .order('code', { ascending: false })
      .limit(1)

    let nextNumber = 1
    if (lastAta && lastAta.length > 0) {
      const lastCode = lastAta[0].code
      const match = lastCode.match(/A-(\d+)/)
      if (match) {
        nextNumber = parseInt(match[1]) + 1
      }
    }

    const code = `A-${String(nextNumber).padStart(4, '0')}`

    const { data: user } = await supabase.auth.getUser()
    const authUserId = user?.user?.id

    if (!authUserId) {
      throw new Error('Usuário autenticado não encontrado')
    }
    
    // Get the omnia_users.id for the current authenticated user
    let { data: omniaUser } = await supabase
      .from('omnia_users')
      .select('id')
      .eq('auth_user_id', authUserId)
      .single();
    
    // If user doesn't exist in omnia_users, create it
    if (!omniaUser && user?.user) {
      const { data: newOmniaUser, error: createUserError } = await supabase
        .from('omnia_users')
        .insert({
          auth_user_id: user.user.id,
          name: user.user.user_metadata?.name || user.user.email || 'Usuário',
          email: user.user.email || '',
          roles: ['USUARIO']
        })
        .select('id')
        .single();
      
      if (createUserError) {
        console.error('Error creating omnia_user:', createUserError);
        throw new Error('Erro ao criar perfil do usuário');
      }
      
      omniaUser = newOmniaUser;
    }
    
    const { data: newAta, error } = await supabase
      .from('omnia_atas')
      .insert({
        code,
        title: data.title,
        description: data.description,
        meeting_date: data.meetingDate,
        secretary_id: data.secretary?.id,
        responsible_id: data.responsible?.id,
        status_id: data.statusId,
        condominium_id: data.condominiumId,
        ticket: data.ticket,
        tags: data.tags || [],
        created_by: omniaUser?.id
      })
      .select(`
        *,
        omnia_users:omnia_users!omnia_atas_secretary_id_fkey (id, name, roles, avatar_url, color),
        responsible_user:omnia_users!omnia_atas_responsible_id_fkey (id, name, roles, avatar_url, color)
      `)
      .single()

    if (error) throw error

    // Get statuses for transformation
    const { data: statusesData } = await supabaseUntyped
      .from('omnia_statuses')
      .select('*')
      .order('order_position')

    const statuses = statusesData?.map(transformStatusFromDB) || []

    return transformAtaFromDB(newAta, statuses)
  },

  async update(id: string, data: Partial<Omit<Ata, 'id' | 'createdAt'>>): Promise<Ata | null> {
    const updateData: DbAtaUpdate = {}
    
    if (data.title !== undefined) updateData.title = data.title
    if (data.description !== undefined) updateData.description = data.description
    if (data.meetingDate !== undefined) updateData.meeting_date = data.meetingDate
    if (data.secretary !== undefined) updateData.secretary_id = data.secretary?.id
    if (data.responsible !== undefined) updateData.responsible_id = data.responsible?.id
    if (data.statusId !== undefined) updateData.status_id = data.statusId
    if (data.condominiumId !== undefined) updateData.condominium_id = data.condominiumId
    if (data.ticket !== undefined) updateData.ticket = data.ticket
    if (data.tags !== undefined) updateData.tags = data.tags

    const { data: updatedAta, error } = await supabase
      .from('omnia_atas')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        omnia_users:omnia_users!omnia_atas_secretary_id_fkey (id, name, roles, avatar_url, color),
        responsible_user:omnia_users!omnia_atas_responsible_id_fkey (id, name, roles, avatar_url, color),
        omnia_attachments:omnia_attachments!omnia_attachments_ata_id_fkey (id, name, url, size_kb, mime_type, created_at, comment_id),
        omnia_comments:omnia_comments!omnia_comments_ata_id_fkey (
          id, body, created_at, author_id,
          author_user:omnia_users!omnia_comments_author_id_fkey (id, name, roles, avatar_url, color)
        )
      `)
      .maybeSingle()

    if (error) {
      console.error('AtasRepo: Error updating ata:', error)
      throw error
    }

    if (!updatedAta) return null

    // Get statuses for transformation
    const { data: statusesData } = await supabaseUntyped
      .from('omnia_statuses')
      .select('*')
      .order('order_position')

    const statuses = statusesData?.map(transformStatusFromDB) || []

    return transformAtaFromDB(updatedAta, statuses)
  },

  async remove(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('omnia_atas')
      .delete()
      .eq('id', id)

    if (error) throw error
    return true
  },

  async addComment(ataId: string, comment: Omit<Comment, 'id' | 'createdAt'>): Promise<Comment | null> {
    logger.debug('AtasRepo: addComment called with:', { ataId, comment })

    // Get current user from omnia_users
    const { data: user } = await supabase.auth.getUser()
    if (!user.user) {
      console.error('AtasRepo: No authenticated user')
      return null
    }

    const { data: omniaUser } = await supabase
      .from('omnia_users')
      .select('id')
      .eq('auth_user_id', user.user.id)
      .single()

    if (!omniaUser) {
      console.error('AtasRepo: Omnia user not found')
      return null
    }

    console.log('AtasRepo: Creating comment with data:', {
      ata_id: ataId,
      author_id: omniaUser.id,
      body: comment.body,
      created_by: omniaUser.id,
      attachments: comment.attachments
    })

    const { data: newComment, error } = await supabaseUntyped
      .from('omnia_comments')
      .insert({
        ata_id: ataId,
        author_id: omniaUser.id,
        body: comment.body,
        created_by: omniaUser.id
      })
      .select(`
        *,
        author_user:omnia_users!omnia_comments_author_id_fkey (id, name, roles, avatar_url, color)
      `)
      .single()

    if (error) {
      console.error('AtasRepo: Error creating comment:', error)
      throw error
    }

    console.log('AtasRepo: Comment created successfully:', newComment)

    // Save attachments if any
    let savedAttachments: Attachment[] = []
    if (comment.attachments && comment.attachments.length > 0) {
      console.log('AtasRepo: Saving attachments:', comment.attachments)
      
      const attachmentsToInsert = comment.attachments.map(att => ({
        ata_id: ataId,
        comment_id: newComment.id,
        name: att.name,
        url: att.url,
        size_kb: att.sizeKB,
        mime_type: att.mime,
        uploaded_by: user.user.id
      }))

      console.log('AtasRepo: Inserting attachments:', attachmentsToInsert)

      const { data: insertedAttachments, error: attachError } = await supabaseUntyped
        .from('omnia_attachments')
        .insert(attachmentsToInsert)
        .select('*')

      if (attachError) {
        console.error('AtasRepo: Error saving attachments:', attachError)
      } else {
        console.log('AtasRepo: Attachments saved successfully:', insertedAttachments)
        savedAttachments = insertedAttachments?.map((att: DbAttachment) => mapDbAttachment(att)) || []
      }
    }

    return {
      id: newComment.id,
      author: mapDbUserToUserRef(newComment.author_user) ?? {
        id: newComment.author_id,
        name: newComment.author_user?.name || 'Usuário',
        email: '',
        roles: normalizeRoles(newComment.author_user?.roles),
        avatarUrl: newComment.author_user?.avatar_url ?? undefined,
        color: newComment.author_user?.color ?? undefined
      },
      body: newComment.body,
      createdAt: newComment.created_at,
      attachments: savedAttachments
    }
  },

  async addAttachment(ataId: string, attachment: Omit<Attachment, 'id' | 'createdAt'>): Promise<Attachment | null> {
    const { data: user } = await supabase.auth.getUser()

    const { data: newAttachment, error } = await supabaseUntyped
      .from('omnia_attachments')
      .insert({
        ata_id: ataId,
        name: attachment.name,
        url: attachment.url,
        size_kb: attachment.sizeKB,
        mime_type: attachment.mime,
        uploaded_by: user.user?.id
      })
      .select('*')
      .single()

    if (error) throw error

    return {
      id: newAttachment.id,
      name: newAttachment.name,
      url: newAttachment.url,
      sizeKB: newAttachment.size_kb,
      mime: newAttachment.mime_type,
      createdAt: newAttachment.created_at
    }
  },

  async updateComment(commentId: string, body: string): Promise<Comment | null> {
    const { data: updatedComment, error } = await supabaseUntyped
      .from('omnia_comments')
      .update({ body })
      .eq('id', commentId)
      .select(`
        *,
        author_user:omnia_users!omnia_comments_author_id_fkey (id, name, roles, avatar_url, color)
      `)
      .single()

    if (error) throw error
    if (!updatedComment) return null

    // Get attachments separately to avoid complex join issues
    const { data: attachments } = await supabaseUntyped
      .from('omnia_attachments')
      .select('*')
      .eq('comment_id', commentId)

    return {
      id: updatedComment.id,
      body: updatedComment.body,
      author: mapDbUserToUserRef(updatedComment.author_user) ?? {
        id: updatedComment.author_id,
        name: updatedComment.author_user?.name || 'Usuário',
        email: '',
        roles: normalizeRoles(updatedComment.author_user?.roles),
        avatarUrl: updatedComment.author_user?.avatar_url ?? undefined,
        color: updatedComment.author_user?.color ?? undefined
      },
      attachments: attachments?.map(mapDbAttachment) || [],
      createdAt: updatedComment.created_at
    }
  },

  async removeComment(commentId: string): Promise<boolean> {
    const { error } = await supabaseUntyped
      .from('omnia_comments')
      .delete()
      .eq('id', commentId)

    if (error) throw error
    return true
  },

  async removeAttachment(attachmentId: string): Promise<boolean> {
    const { error } = await supabaseUntyped
      .from('omnia_attachments')
      .delete()
      .eq('id', attachmentId)

    if (error) throw error
    return true
  },

  async getStatuses(): Promise<Status[]> {
    const { data, error } = await supabaseUntyped
      .from('omnia_statuses')
      .select('*')
      .order('order_position')

    if (error) throw error

    return data?.map(transformStatusFromDB) || []
  },

  async getUsers(): Promise<UserRef[]> {
    // Use safe column selection (no email for general access)
    const { data, error } = await supabase
      .from('omnia_users')
      .select('id, name, roles, avatar_url, color')
      .order('name', { ascending: true })
    
    if (error) {
      throw new Error(`Erro ao buscar usuários: ${error.message}`)
    }
    
    return data?.map((user) => mapDbUserToUserRef(user)!).filter(Boolean) as UserRef[] || []
  }
}
