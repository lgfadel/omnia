import { supabase } from "@/integrations/supabase/client"
import { Ata, Comment, Attachment, Status, UserRef, Role } from "@/data/fixtures"

// Transform database record to Ata type
const transformAtaFromDB = (dbAta: any, statuses: Status[]): Ata => {
  const status = statuses.find(s => s.id === dbAta.status_id)
  
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
      role: dbAta.omnia_users.role as Role,
      avatarUrl: dbAta.omnia_users.avatar_url
    } : undefined,
    statusId: dbAta.status_id,
    ticket: dbAta.ticket,
    tags: dbAta.tags || [],
    commentCount: dbAta.comment_count || 0,
    attachments: dbAta.omnia_attachments || [],
    comments: dbAta.omnia_comments || []
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
        omnia_users (id, name, email, role, avatar_url),
        omnia_attachments (id, name, url, size_kb, mime_type, created_at),
        omnia_comments (id, body, created_at, author_id, omnia_users (id, name, email, role, avatar_url))
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
        omnia_users (id, name, email, role, avatar_url),
        omnia_attachments (id, name, url, size_kb, mime_type, created_at),
        omnia_comments (id, body, created_at, author_id, omnia_users (id, name, email, role, avatar_url))
      `)
      .eq('code', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }

    return data ? transformAtaFromDB(data, statuses) : null
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
        omnia_users (id, name, email, role, avatar_url)
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
        omnia_users (id, name, email, role, avatar_url),
        omnia_attachments (id, name, url, size_kb, mime_type, created_at),
        omnia_comments (id, body, created_at, author_id, omnia_users (id, name, email, role, avatar_url))
      `)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }

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
    // First get the ata to get its UUID
    const { data: ata } = await supabase
      .from('omnia_atas')
      .select('id')
      .eq('code', ataId)
      .single()

    if (!ata) return null

    // Get current user from omnia_users
    const { data: user } = await supabase.auth.getUser()
    if (!user.user) return null

    const { data: omniaUser } = await supabase
      .from('omnia_users')
      .select('id')
      .eq('auth_user_id', user.user.id)
      .single()

    if (!omniaUser) return null

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
        omnia_users (id, name, email, role, avatar_url)
      `)
      .single()

    if (error) throw error

    return {
      id: newComment.id,
      author: {
        id: newComment.omnia_users.id,
        name: newComment.omnia_users.name,
        email: newComment.omnia_users.email,
        role: newComment.omnia_users.role as Role,
        avatarUrl: newComment.omnia_users.avatar_url
      },
      body: newComment.body,
      createdAt: newComment.created_at,
      attachments: []
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
      role: user.role as Role,
      avatarUrl: user.avatar_url
    })) || []
  }
}