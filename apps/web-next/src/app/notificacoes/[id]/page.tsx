'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/integrations/supabase/client'
import { notificationPath } from '@/lib/push/navigation'

export default function NotificationDestination() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  useEffect(() => {
    let cancelled = false
    async function open() {
      const { data } = await supabase.from('omnia_notifications').select('id, ticket_id, ata_id, comment_id').eq('id', id).maybeSingle()
      if (!data) { if (!cancelled) router.replace('/'); return }
      let ataId = data.ata_id
      if (!ataId && data.comment_id) {
        const { data: comment } = await supabase.from('omnia_comments').select('ata_id').eq('id', data.comment_id).maybeSingle()
        ataId = comment?.ata_id ?? null
      }
      if (!cancelled) router.replace(notificationPath({ ticket_id: data.ticket_id, ata_id: ataId }))
    }
    void open()
    return () => { cancelled = true }
  }, [id, router])
  return <p className="p-6">Abrindo notificação...</p>
}
