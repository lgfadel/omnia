import { create } from 'zustand'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'
import { logger } from '@/lib/logging'
import { notificationsRepoSupabase, type OmniaNotification } from '@/repositories/notificationsRepo.supabase'

interface NotificationsStore {
  notifications: OmniaNotification[]
  unreadCount: number
  loading: boolean
  error: string | null
  channel: RealtimeChannel | null
  currentUserId: string | null

  init: (userId: string) => Promise<void>
  cleanup: () => void

  loadRecent: (userId: string) => Promise<void>
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
}

const computeUnreadCount = (notifications: OmniaNotification[]) =>
  notifications.reduce((acc, n) => (n.is_read ? acc : acc + 1), 0)

export const useNotificationsStore = create<NotificationsStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,
  channel: null,
  currentUserId: null,

  init: async (userId: string) => {
    try {
      const { data } = await supabase.auth.getSession()
      supabase.realtime.setAuth(data.session?.access_token ?? '')
    } catch (error) {
      logger.warn('Failed to set realtime auth token before subscribing', error)
    }

    const { channel, currentUserId } = get()
    if (channel && currentUserId === userId) return

    if (channel) {
      try {
        channel.unsubscribe()
      } catch (error) {
        logger.warn('Failed to unsubscribe previous notifications channel', error)
      }
    }

    set({ currentUserId: userId })

    await get().loadRecent(userId)

    const nextChannel = supabase
      .channel(`omnia_notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'omnia_notifications',
        },
        (payload) => {
          const inserted = payload.new as OmniaNotification

          if (inserted.user_id !== userId) return

          set((state) => {
            const exists = state.notifications.some((n) => n.id === inserted.id)
            const nextNotifications = exists
              ? state.notifications
              : [inserted, ...state.notifications]

            return {
              notifications: nextNotifications,
              unreadCount: computeUnreadCount(nextNotifications),
            }
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'omnia_notifications',
        },
        (payload) => {
          const updated = payload.new as OmniaNotification

          if (updated.user_id !== userId) return

          set((state) => {
            const nextNotifications = state.notifications.map((n) =>
              n.id === updated.id ? updated : n
            )

            return {
              notifications: nextNotifications,
              unreadCount: computeUnreadCount(nextNotifications),
            }
          })
        }
      )
      .subscribe((status) => {
        logger.debug('Notifications realtime status:', status)
      })

    set({ channel: nextChannel })
  },

  cleanup: () => {
    const { channel } = get()
    if (channel) {
      try {
        channel.unsubscribe()
      } catch (error) {
        logger.warn('Failed to unsubscribe notifications channel', error)
      }
    }

    set({ channel: null, currentUserId: null })
  },

  loadRecent: async (userId: string) => {
    set({ loading: true, error: null })

    try {
      const data = await notificationsRepoSupabase.listRecent({ userId, limit: 50 })
      set({
        notifications: data,
        unreadCount: computeUnreadCount(data),
        loading: false,
      })
    } catch (error: any) {
      set({ loading: false, error: error?.message ?? 'Erro ao carregar notificações' })
    }
  },

  markAsRead: async (id: string) => {
    try {
      const updated = await notificationsRepoSupabase.markAsRead(id)
      set((state) => {
        const nextNotifications = state.notifications.map((n) =>
          n.id === updated.id ? updated : n
        )
        return {
          notifications: nextNotifications,
          unreadCount: computeUnreadCount(nextNotifications),
        }
      })
    } catch (error: any) {
      set({ error: error?.message ?? 'Erro ao marcar como lida' })
    }
  },

  markAllAsRead: async () => {
    const userId = get().currentUserId
    if (!userId) return

    try {
      await notificationsRepoSupabase.markAllAsRead({ userId })

      set((state) => {
        const now = new Date().toISOString()
        const nextNotifications = state.notifications.map((n) =>
          n.is_read ? n : { ...n, is_read: true }
        )

        return {
          notifications: nextNotifications,
          unreadCount: 0,
        }
      })
    } catch (error: any) {
      set({ error: error?.message ?? 'Erro ao marcar todas como lidas' })
    }
  },
}))
