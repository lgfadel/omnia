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
  notifications.reduce((acc, n) => (n.read_at ? acc : acc + 1), 0)

let generation = 0
let eventVersion = 0
let requestVersion = 0
const recentEvents = new Map<string, { version: number; notification: OmniaNotification }>()

export const useNotificationsStore = create<NotificationsStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,
  channel: null,
  currentUserId: null,

  init: async (userId: string) => {
    if (get().channel && get().currentUserId === userId) return
    const currentGeneration = ++generation
    try {
      const { data } = await supabase.auth.getSession()
      supabase.realtime.setAuth(data.session?.access_token ?? '')
    } catch (error) {
      logger.warn('Failed to set realtime auth token before subscribing', error)
    }

    if (currentGeneration !== generation) return

    const { channel, currentUserId } = get()
    if (channel && currentUserId === userId) return

    if (channel) {
      try {
        channel.unsubscribe()
      } catch (error) {
        logger.warn('Failed to unsubscribe previous notifications channel', error)
      }
    }

    recentEvents.clear()
    set({ currentUserId: userId, notifications: [], unreadCount: 0 })

    let initialLoad: Promise<void> = Promise.resolve()
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

          if (inserted.user_id !== userId || currentGeneration !== generation) return
          recentEvents.set(inserted.id, { version: ++eventVersion, notification: inserted })

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

          if (updated.user_id !== userId || currentGeneration !== generation) return
          recentEvents.set(updated.id, { version: ++eventVersion, notification: updated })

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
        if (status === 'SUBSCRIBED') {
          void initialLoad.then(() => {
            if (currentGeneration === generation) return get().loadRecent(userId)
          })
        }
      })

    set({ channel: nextChannel })
    initialLoad = get().loadRecent(userId)
    await initialLoad
  },

  cleanup: () => {
    generation++
    recentEvents.clear()
    const { channel } = get()
    if (channel) {
      try {
        channel.unsubscribe()
      } catch (error) {
        logger.warn('Failed to unsubscribe notifications channel', error)
      }
    }

    set({ channel: null, currentUserId: null, notifications: [], unreadCount: 0, loading: false, error: null })
  },

  loadRecent: async (userId: string) => {
    const requestGeneration = generation
    const startingVersion = eventVersion
    const request = ++requestVersion
    set({ loading: true, error: null })

    try {
      const data = await notificationsRepoSupabase.listRecent({ userId, limit: 50 })
      if (requestGeneration !== generation || request !== requestVersion || get().currentUserId !== userId) return
      const byId = new Map(data.map((n) => [n.id, n]))
      for (const { version, notification } of recentEvents.values()) {
        if (version > startingVersion) byId.set(notification.id, notification)
      }
      const notifications = Array.from(byId.values()).sort((a, b) =>
        (b.created_at ?? '').localeCompare(a.created_at ?? '')
      )
      set({
        notifications,
        unreadCount: computeUnreadCount(notifications),
        loading: false,
      })
    } catch (error: unknown) {
      if (requestGeneration !== generation || request !== requestVersion || get().currentUserId !== userId) return
      const message = error instanceof Error ? error.message : 'Erro ao carregar notificações'
      set({ loading: false, error: message })
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao marcar como lida'
      set({ error: message })
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
          n.read_at ? n : { ...n, read_at: now }
        )

        return {
          notifications: nextNotifications,
          unreadCount: 0,
        }
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao marcar todas como lidas'
      set({ error: message })
    }
  },
}))
