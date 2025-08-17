import { supabase } from "@/integrations/supabase/client"
import { Ata, Comment, Attachment, Status, UserRef, Role } from "@/data/fixtures"

// Transform database record to Ata type
const transformAtaFromDB = (dbAta: any, statuses: Status[]): Ata => {
  const status = statuses.find(s => s.id === dbAta.status_id)
  
  // Group attachments by comment_id for quick lookup
  const attachmentsByCommentId: Record<string, any[]> = {}
  ;(dbAta.omnia_attachments || []).forEach((att: any) => {
    if (att.comment_id) {
      if (!attachmentsByCommentId[att.comment_id]) attachmentsByCommentId[att.comment_id] = []
      attachmentsByCommentId[att.comment_id].push(att)
    }
  })

  // Transform comments with proper author handling and mapped attachments
  const transformedComments = (dbAta.omnia_comments || []).map((comment: any) => {
    const rawAttachments = attachmentsByCommentId[comment.id] || []
    const mappedAttachments: Attachment[] = rawAttachments.map((att: any) => ({
      id: att.id,
      name: att.name,
      url: att.url,
      sizeKB: att.size_kb,
      mime: att.mime_type,
      createdAt: att.created_at || new Date().toISOString()
    }))

    return {
      id: comment.id,
      body: comment.body,
      createdAt: comment.created_at,
      author: comment.author_user ? {
        id: comment.author_user.id,
        name: comment.author_user.name,
        email: comment.author_user.email,
        roles: (comment.author_user.roles || []) as Role[],
        avatarUrl: comment.author_user.avatar_url
      } : {
        id: comment.author_id,
        name: 'Usuário não encontrado',
        email: '',
        roles: [],
        avatarUrl: null
      },
      attachments: mappedAttachments
    }
  })
  
  return {
    id: dbAta.code,
    title: dbAta.title,
    description: dbAta.description,
    meetingDate: dbAta.meeting_date,
    createdAt: dbAta.created_at,
    updatedAt: dbAta.updated_at,
    secretary: dbAta.omnia_users ? {
      id: dbAta.omnia_users.id,
      name: dbAta.omnia_users.name,
      email: dbAta.omnia_users.email,
      roles: (dbAta.omnia_users.roles || []) as Role[],
      avatarUrl: dbAta.omnia_users.avatar_url
    } : undefined,
    statusId: dbAta.status_id,
    ticket: dbAta.ticket,
    tags: dbAta.tags || [],
    commentCount: dbAta.comment_count || 0,
    // Transform attachments
    attachments: (dbAta.omnia_attachments || []).map((att: any) => ({
      id: att.id,
      name: att.name,
      url: att.url,
      sizeKB: att.size_kb,
      mime: att.mime_type,
      createdAt: att.created_at || new Date().toISOString() // Ensure valid date
    })),
    comments: transformedComments
  }
}

// Transform database record to Status type
const transformStatusFromDB = (dbStatus: any): Status => ({
  id: dbStatus.id,
  name: dbStatus.name,
  color: dbStatus.color,
  order: dbStatus.order_position,
  isDefault: dbStatus.is_default
})

export const atasRepoSupabase = {
  async list(search?: string, statusFilter?: string[]): Promise<Ata[]> {
    // First get statuses for transformation
    const { data: statusesData } = await supabase
      .from('omnia_statuses')
      .select('*')
      .order('order_position')

    const statuses = statusesData?.map(transformStatusFromDB) || []

    let query = supabase
      .from('omnia_atas')
      .select(`
        *,
        omnia_users:omnia_users!omnia_atas_secretary_id_fkey (id, name, email, roles, avatar_url),
        omnia_attachments:omnia_attachments!omnia_attachments_ata_id_fkey (id, name, url, size_kb, mime_type, created_at, comment_id),
        omnia_comments:omnia_comments!omnia_comments_ata_id_fkey (
          id, body, created_at, author_id,
          author_user:omnia_users!omnia_comments_author_id_fkey (id, name, email, roles, avatar_url)
        )
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

    return data?.map(ata => transformAtaFromDB(ata, statuses)) || []
  },

  async getById(id: string): Promise<Ata | null> {
    console.log('AtasRepo: Getting ata by id:', id)
    
    // First get statuses for transformation
    const { data: statusesData } = await supabase
      .from('omnia_statuses')
      .select('*')
      .order('order_position')

    const statuses = statusesData?.map(transformStatusFromDB) || []

    const { data, error } = await supabase
      .from('omnia_atas')
      .select(`
        *,
        omnia_users:omnia_users!omnia_atas_secretary_id_fkey (id, name, email, roles, avatar_url),
        omnia_attachments:omnia_attachments!omnia_attachments_ata_id_fkey (id, name, url, size_kb, mime_type, created_at, comment_id),
        omnia_comments:omnia_comments!omnia_comments_ata_id_fkey (
          id, body, created_at, author_id,
          author_user:omnia_users!omnia_comments_author_id_fkey (id, name, email, roles, avatar_url)
        )
      `)
      .eq('code', id)
      .maybeSingle()

    if (error) {
      console.error('AtasRepo: Error getting ata:', error)
      throw error
    }

    if (!data) {
      console.log('AtasRepo: No ata found with id:', id)
      return null
    }

    console.log('AtasRepo: Found ata:', data)
    return transformAtaFromDB(data, statuses)
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
    
    const { data: newAta, error } = await supabase
      .from('omnia_atas')
      .insert({
        code,
        title: data.title,
        description: data.description,
        meeting_date: data.meetingDate,
        secretary_id: data.secretary?.id,
        status_id: data.statusId,
        ticket: data.ticket,
        tags: data.tags || [],
        created_by: user.user?.id
      })
      .select(`
        *,
        omnia_users:omnia_users!omnia_atas_secretary_id_fkey (id, name, email, roles, avatar_url)
      `)
      .single()

    if (error) throw error

    // Get statuses for transformation
    const { data: statusesData } = await supabase
      .from('omnia_statuses')
      .select('*')
      .order('order_position')

    const statuses = statusesData?.map(transformStatusFromDB) || []

    return transformAtaFromDB(newAta, statuses)
  },

  async update(id: string, data: Partial<Omit<Ata, 'id' | 'createdAt'>>): Promise<Ata | null> {
    const updateData: any = {}
    
    if (data.title !== undefined) updateData.title = data.title
    if (data.description !== undefined) updateData.description = data.description
    if (data.meetingDate !== undefined) updateData.meeting_date = data.meetingDate
    if (data.secretary !== undefined) updateData.secretary_id = data.secretary?.id
    if (data.statusId !== undefined) updateData.status_id = data.statusId
    if (data.ticket !== undefined) updateData.ticket = data.ticket
    if (data.tags !== undefined) updateData.tags = data.tags

    const { data: updatedAta, error } = await supabase
      .from('omnia_atas')
      .update(updateData)
      .eq('code', id)
      .select(`
        *,
        omnia_users:omnia_users!omnia_atas_secretary_id_fkey (id, name, email, roles, avatar_url),
        omnia_attachments:omnia_attachments!omnia_attachments_ata_id_fkey (id, name, url, size_kb, mime_type, created_at, comment_id),
        omnia_comments:omnia_comments!omnia_comments_ata_id_fkey (
          id, body, created_at, author_id,
          author_user:omnia_users!omnia_comments_author_id_fkey (id, name, email, roles, avatar_url)
        )
      `)
      .maybeSingle()

    if (error) {
      console.error('AtasRepo: Error updating ata:', error)
      throw error
    }

    if (!updatedAta) return null

    // Get statuses for transformation
    const { data: statusesData } = await supabase
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
      .eq('code', id)

    if (error) throw error
    return true
  },

  async addComment(ataId: string, comment: Omit<Comment, 'id' | 'createdAt'>): Promise<Comment | null> {
    console.log('AtasRepo: addComment called with:', { ataId, comment })
    
    // First get the ata to get its UUID
    const { data: ata } = await supabase
      .from('omnia_atas')
      .select('id')
      .eq('code', ataId)
      .single()

    if (!ata) {
      console.error('AtasRepo: ATA not found:', ataId)
      return null
    }

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
      ata_id: ata.id,
      author_id: omniaUser.id,
      body: comment.body,
      created_by: user.user.id,
      attachments: comment.attachments
    })

    const { data: newComment, error } = await supabase
      .from('omnia_comments')
      .insert({
        ata_id: ata.id,
        author_id: omniaUser.id,
        body: comment.body,
        created_by: user.user.id
      })
      .select(`
        *,
        author_user:omnia_users!omnia_comments_author_id_fkey (id, name, email, roles, avatar_url)
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
        ata_id: ata.id,
        comment_id: newComment.id,
        name: att.name,
        url: att.url,
        size_kb: att.sizeKB,
        mime_type: att.mime,
        uploaded_by: user.user.id
      }))

      console.log('AtasRepo: Inserting attachments:', attachmentsToInsert)

      const { data: insertedAttachments, error: attachError } = await supabase
        .from('omnia_attachments')
        .insert(attachmentsToInsert)
        .select('*')

      if (attachError) {
        console.error('AtasRepo: Error saving attachments:', attachError)
      } else {
        console.log('AtasRepo: Attachments saved successfully:', insertedAttachments)
        savedAttachments = insertedAttachments?.map(att => ({
          id: att.id,
          name: att.name,
          url: att.url,
          sizeKB: att.size_kb,
          mime: att.mime_type,
          createdAt: att.created_at
        })) || []
      }
    }

    return {
      id: newComment.id,
      author: {
        id: newComment.author_user.id,
        name: newComment.author_user.name,
        email: newComment.author_user.email,
        roles: (newComment.author_user.roles || []) as Role[],
        avatarUrl: newComment.author_user.avatar_url
      },
      body: newComment.body,
      createdAt: newComment.created_at,
      attachments: savedAttachments
    }
  },

  async addAttachment(ataId: string, attachment: Omit<Attachment, 'id' | 'createdAt'>): Promise<Attachment | null> {
    // First get the ata to get its UUID
    const { data: ata } = await supabase
      .from('omnia_atas')
      .select('id')
      .eq('code', ataId)
      .single()

    if (!ata) return null

    const { data: user } = await supabase.auth.getUser()

    const { data: newAttachment, error } = await supabase
      .from('omnia_attachments')
      .insert({
        ata_id: ata.id,
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

  async removeComment(commentId: string): Promise<boolean> {
    const { error } = await supabase
      .from('omnia_comments')
      .delete()
      .eq('id', commentId)

    if (error) throw error
    return true
  },

  async removeAttachment(attachmentId: string): Promise<boolean> {
    const { error } = await supabase
      .from('omnia_attachments')
      .delete()
      .eq('id', attachmentId)

    if (error) throw error
    return true
  },

  async getStatuses(): Promise<Status[]> {
    const { data, error } = await supabase
      .from('omnia_statuses')
      .select('*')
      .order('order_position')

    if (error) throw error

    return data?.map(transformStatusFromDB) || []
  },

  async getUsers(): Promise<UserRef[]> {
    console.log('AtasRepo: Fetching users...')
    
    const { data, error } = await supabase
      .from('omnia_users')
      .select('*')
      .order('name', { ascending: true })
    
    if (error) {
      console.error('AtasRepo: Error fetching users:', error)
      throw new Error(`Erro ao buscar usuários: ${error.message}`)
    }
    
    return data?.map((user: any) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      roles: (user.roles || []) as Role[],
      avatarUrl: user.avatar_url
    })) || []
  }
}
