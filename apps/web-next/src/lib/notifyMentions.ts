import { supabase } from '@/integrations/supabase/client'

type MentionPayload = {
  body: string
  ticket_id?: string | null
  comment_id?: string | null
  ticket_comment_id?: string | null
}

export async function notifyMentions(payload: MentionPayload): Promise<void> {
  const { error } = await supabase.functions.invoke('notify-mentions', { body: payload })
  if (error) throw error
}
