"use client"

import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { useNotificationsStore } from '@/stores/notifications.store'
import { supabase } from '@/integrations/supabase/client'
import { toast } from '@/hooks/use-toast'

const formatToastTitle = (type: string) => {
  switch (type) {
    case 'mentioned':
      return 'Você foi mencionado'
    case 'assigned':
      return 'Ticket atribuído'
    case 'secretary':
      return 'Novo secretário'
    case 'responsible':
      return 'Novo responsável'
    default:
      return 'Nova notificação'
  }
}

const resolveNotificationContext = async (n: {
  related_entity_id: string | null
  related_entity_type: string | null
}): Promise<{ label: string; title: string } | null> => {
  const ticket_id = n.related_entity_type === 'ticket' ? n.related_entity_id : null
  const ata_id = n.related_entity_type === 'ata' ? n.related_entity_id : null
  const comment_id = n.related_entity_type === 'comment' ? n.related_entity_id : null
  
  if (ticket_id) {
    const { data } = await supabase
      .from('omnia_tickets')
      .select('id, title')
      .eq('id', ticket_id)
      .maybeSingle()

    const title = (data as { title: string | null } | null)?.title
    return title ? { label: 'Tarefa', title } : null
  }

  const ataId =
    ata_id ||
    (
      comment_id
        ? (
            (
              await supabase
                .from('omnia_comments')
                .select('ata_id')
                .eq('id', comment_id)
                .maybeSingle()
            ).data as { ata_id: string | null } | null
          )?.ata_id
        : null
    )

  if (!ataId) return null

  const { data } = await supabase
    .from('omnia_atas')
    .select('id, title')
    .eq('id', ataId)
    .maybeSingle()

  const title = (data as { title: string | null } | null)?.title
  return title ? { label: 'Ata', title } : null
}

export function NotificationsBootstrap() {
  const userId = useAuthStore((s) => s.userProfile?.id)
  const init = useNotificationsStore((s) => s.init)
  const cleanup = useNotificationsStore((s) => s.cleanup)
  const notifications = useNotificationsStore((s) => s.notifications)
  const loading = useNotificationsStore((s) => s.loading)

  const isReadyRef = useRef(false)
  const initStartedRef = useRef(false)
  const prevLoadingRef = useRef(false)
  const knownIdsRef = useRef<Set<string>>(new Set())
  const userIdRef = useRef<string | null>(null)
  const contextCacheRef = useRef<Map<string, { label: string; title: string }>>(new Map())

  useEffect(() => {
    if (!userId) return

    initStartedRef.current = true
    init(userId)

    return () => {
      cleanup()
    }
  }, [userId, init, cleanup])

  useEffect(() => {
    if (!userId) return

    if (userIdRef.current !== userId) {
      userIdRef.current = userId
      isReadyRef.current = false
      initStartedRef.current = false
      prevLoadingRef.current = false
      knownIdsRef.current = new Set()
    }

    if (!initStartedRef.current) return

    if (loading) {
      prevLoadingRef.current = true
      return
    }

    if (!isReadyRef.current) {
      if (!prevLoadingRef.current) return
      knownIdsRef.current = new Set(notifications.map((n) => n.id))
      isReadyRef.current = true
      prevLoadingRef.current = false
      return
    }

    prevLoadingRef.current = false

    const incoming = notifications.filter((n) => !knownIdsRef.current.has(n.id))
    if (incoming.length === 0) return

    for (const n of incoming) {
      knownIdsRef.current.add(n.id)
    }

    if (incoming.length === 1) {
      const n = incoming[0]
      const cacheKey = n.related_entity_type && n.related_entity_id
        ? `${n.related_entity_type}:${n.related_entity_id}`
        : null

      const showToast = (context: { label: string; title: string } | null) => {
        toast({
          title: formatToastTitle(n.type),
          description: context ? `${context.label}: ${context.title}` : 'Você recebeu uma nova notificação.',
          variant: 'destructive',
          duration: 5000,
        })
      }

      if (cacheKey && contextCacheRef.current.has(cacheKey)) {
        showToast(contextCacheRef.current.get(cacheKey) ?? null)
        return
      }

      void (async () => {
        try {
          const context = await resolveNotificationContext(n)
          if (cacheKey && context) contextCacheRef.current.set(cacheKey, context)
          showToast(context)
        } catch {
          showToast(null)
        }
      })()
    } else {
      toast({
        title: 'Novas notificações',
        description: `Você recebeu ${incoming.length} novas notificações.`,
        variant: 'destructive',
        duration: 5000,
      })
    }
  }, [userId, notifications, loading])

  return null
}
