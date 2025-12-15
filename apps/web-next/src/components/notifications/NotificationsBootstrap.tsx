"use client"

import { useEffect } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { useNotificationsStore } from '@/stores/notifications.store'

export function NotificationsBootstrap() {
  const userId = useAuthStore((s) => s.userProfile?.id)
  const init = useNotificationsStore((s) => s.init)
  const cleanup = useNotificationsStore((s) => s.cleanup)

  useEffect(() => {
    if (!userId) return

    init(userId)

    return () => {
      cleanup()
    }
  }, [userId, init, cleanup])

  return null
}
