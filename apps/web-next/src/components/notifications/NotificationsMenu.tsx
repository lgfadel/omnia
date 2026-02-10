"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useNotificationsStore } from '@/stores/notifications.store'
import { supabase } from '@/integrations/supabase/client'

const formatActionLabel = (type: string) => {
  switch (type) {
    case 'mentioned':
      return 'Você foi mencionado'
    case 'assigned':
      return 'O ticket foi atribuído a você'
    case 'secretary':
      return 'Você é o novo secretário'
    case 'responsible':
      return 'Você é o novo responsável'
    default:
      return 'Atualização'
  }
}

const formatNotificationMeta = (createdAt: string | null) => {
  if (!createdAt) return ''
  const d = new Date(createdAt)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function NotificationsMenu() {
  const router = useRouter()
  const notifications = useNotificationsStore((s) => s.notifications)
  const unreadCount = useNotificationsStore((s) => s.unreadCount)
  const markAsRead = useNotificationsStore((s) => s.markAsRead)
  const markAllAsRead = useNotificationsStore((s) => s.markAllAsRead)
  const loading = useNotificationsStore((s) => s.loading)
  const error = useNotificationsStore((s) => s.error)
  const loadRecent = useNotificationsStore((s) => s.loadRecent)
  const currentUserId = useNotificationsStore((s) => s.currentUserId)

  const [entityTitleByNotificationId, setEntityTitleByNotificationId] = useState<Record<string, string>>({})

  const visibleNotifications = useMemo(() => notifications.slice(0, 10), [notifications])

  useEffect(() => {
    const missing = visibleNotifications.filter((n) => entityTitleByNotificationId[n.id] === undefined)
    if (missing.length === 0) return

    const load = async () => {
      try {
        const ticketIds = Array.from(
          new Set(
            missing
              .filter((n) => n.related_entity_type === 'ticket')
              .map((n) => n.related_entity_id)
              .filter(Boolean) as string[]
          )
        )
        const ataIdsDirect = Array.from(
          new Set(
            missing
              .filter((n) => n.related_entity_type === 'ata')
              .map((n) => n.related_entity_id)
              .filter(Boolean) as string[]
          )
        )
        const commentIds = Array.from(
          new Set(
            missing
              .filter((n) => n.related_entity_type === 'comment')
              .map((n) => n.related_entity_id)
              .filter(Boolean) as string[]
          )
        )

        const ticketTitleById: Record<string, string> = {}
        const ataTitleById: Record<string, string> = {}
        const commentToAtaId: Record<string, string> = {}

        if (ticketIds.length > 0) {
          const { data } = await supabase
            .from('omnia_tickets')
            .select('id, title')
            .in('id', ticketIds)

          ;(data ?? []).forEach((t: { id?: string; title?: string }) => {
            if (t?.id && t?.title) ticketTitleById[t.id] = t.title
          })
        }

        if (commentIds.length > 0) {
          const { data } = await supabase
            .from('omnia_comments')
            .select('id, ata_id')
            .in('id', commentIds)

          ;(data ?? []).forEach((c: { id: string; ata_id: string | null }) => {
            if (c.id && c.ata_id) commentToAtaId[c.id] = c.ata_id
          })
        }

        const ataIdsFromComments = Object.values(commentToAtaId)
        const ataIds = Array.from(new Set([...ataIdsDirect, ...ataIdsFromComments]))

        if (ataIds.length > 0) {
          const { data } = await supabase
            .from('omnia_atas')
            .select('id, code, title')
            .in('id', ataIds)

          ;(data ?? []).forEach((a: { id?: string; code?: string; title?: string }) => {
            if (!a?.id) return
            const label = a.title
            if (label) ataTitleById[a.id] = label
          })
        }

        setEntityTitleByNotificationId((prev) => {
          const next = { ...prev }
          for (const n of missing) {
            const entityId = n.related_entity_id
            const entityType = n.related_entity_type
            
            const title =
              (entityType === 'ticket' && entityId ? ticketTitleById[entityId] : null) ||
              (entityType === 'ata' && entityId ? ataTitleById[entityId] : null) ||
              (entityType === 'comment' && entityId ? ataTitleById[commentToAtaId[entityId]] : null)

            if (title) {
              next[n.id] = title
              continue
            }

            if (entityType === 'ticket') next[n.id] = 'Tarefa removida'
            else if (entityType === 'ata' || entityType === 'comment') next[n.id] = 'Ata removida'
            else next[n.id] = 'Notificação'
          }
          return next
        })
      } catch {
        setEntityTitleByNotificationId((prev) => {
          const next = { ...prev }
          for (const n of missing) {
            if (n.related_entity_type === 'ticket') next[n.id] = 'Tarefa'
            else if (n.related_entity_type === 'ata' || n.related_entity_type === 'comment') next[n.id] = 'Ata'
            else next[n.id] = 'Notificação'
          }
          return next
        })
      }
    }

    load()
  }, [visibleNotifications, entityTitleByNotificationId])

  const navigateFromNotification = useCallback(
    async (n: { related_entity_id: string | null; related_entity_type: string | null }) => {
      if (n.related_entity_type === 'ticket' && n.related_entity_id) {
        router.push(`/tarefas/${n.related_entity_id}`)
        return
      }

      if (n.related_entity_type === 'ata' && n.related_entity_id) {
        router.push(`/atas/${n.related_entity_id}`)
        return
      }

      if (n.related_entity_type === 'comment' && n.related_entity_id) {
        const { data } = await supabase
          .from('omnia_comments')
          .select('ata_id')
          .eq('id', n.related_entity_id)
          .maybeSingle()

        const ataId = (data as { ata_id: string | null } | null)?.ata_id
        if (ataId) {
          router.push(`/atas/${ataId}`)
        }
      }
    },
    [router]
  )

  const onMarkAllAsRead = useCallback(async () => {
    await markAllAsRead()
  }, [markAllAsRead])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notificações</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={onMarkAllAsRead}
            disabled={unreadCount === 0}
          >
            Marcar todas como lidas
          </Button>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {error && (
          <DropdownMenuItem
            className="text-muted-foreground"
            onSelect={(e) => {
              e.preventDefault()
            }}
          >
            <div className="flex w-full items-center justify-between gap-2">
              <span>Erro ao carregar</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={async () => {
                  if (!currentUserId) return
                  await loadRecent(currentUserId)
                }}
              >
                Tentar novamente
              </Button>
            </div>
          </DropdownMenuItem>
        )}

        {loading && (
          <DropdownMenuItem disabled className="text-muted-foreground">
            Carregando...
          </DropdownMenuItem>
        )}

        {!loading && notifications.length === 0 && (
          <DropdownMenuItem disabled className="text-muted-foreground">
            Nenhuma notificação
          </DropdownMenuItem>
        )}

        {!loading &&
          visibleNotifications.map((n) => {
            const title =
              entityTitleByNotificationId[n.id] ||
              (n.related_entity_type === 'ticket' ? 'Tarefa' : n.related_entity_type === 'ata' || n.related_entity_type === 'comment' ? 'Ata' : 'Notificação')

            const action = formatActionLabel(n.type)
            const meta = formatNotificationMeta(n.created_at)
            const isUnread = !n.read_at

            return (
              <DropdownMenuItem
                key={n.id}
                className="flex flex-col items-start gap-1"
                onSelect={async () => {
                  if (isUnread) await markAsRead(n.id)
                  await navigateFromNotification(n)
                }}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className={isUnread ? 'font-semibold truncate' : 'truncate'}>{title}</span>
                  {meta && (
                    <span className="text-xs text-muted-foreground">{meta}</span>
                  )}
                </div>
                <div className="w-full text-xs text-muted-foreground">{action}</div>
              </DropdownMenuItem>
            )
          })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
