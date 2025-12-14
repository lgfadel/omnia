import { supabase } from '@/integrations/supabase/client'
import type { Database } from '@/integrations/supabase/types'

export type OmniaNotification = Database['public']['Tables']['omnia_notifications']['Row']

export const notificationsRepoSupabase = {
  async listUnread(params?: { limit?: number; userId?: string }): Promise<OmniaNotification[]> {
    const limit = params?.limit ?? 50

    let query = supabase
      .from('omnia_notifications')
      .select('*')
      .is('read_at', null)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (params?.userId) {
      query = query.eq('user_id', params.userId)
    }

    const { data, error } = await query
    if (error) throw error
    return (data ?? []) as OmniaNotification[]
  },

  async listRecent(params?: { limit?: number; userId?: string }): Promise<OmniaNotification[]> {
    const limit = params?.limit ?? 50

    let query = supabase
      .from('omnia_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (params?.userId) {
      query = query.eq('user_id', params.userId)
    }

    const { data, error } = await query
    if (error) throw error
    return (data ?? []) as OmniaNotification[]
  },

  async markAsRead(id: string): Promise<OmniaNotification> {
    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from('omnia_notifications')
      .update({ read_at: now })
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    return data as OmniaNotification
  },

  async markAllAsRead(params?: { userId?: string }): Promise<number> {
    const now = new Date().toISOString()

    let query = supabase
      .from('omnia_notifications')
      .update({ read_at: now })
      .is('read_at', null)

    if (params?.userId) {
      query = query.eq('user_id', params.userId)
    }

    const { data, error } = await query.select('id')
    if (error) throw error

    return (data ?? []).length
  },
}
