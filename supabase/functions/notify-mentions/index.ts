import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || 'https://omnia.vercel.app'

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Payload = {
  body: string
  ticket_id?: string | null
  comment_id?: string | null
  ticket_comment_id?: string | null
}

const extractMentionedUserIds = (body: string): string[] => {
  const ids = new Set<string>()
  const regex = /@\[([0-9a-fA-F-]{36})\]/g
  for (const match of body.matchAll(regex)) {
    const id = match[1]
    if (id) ids.add(id)
  }
  return Array.from(ids)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAnon = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const { data: authData, error: authError } = await supabaseAnon.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const payload = (await req.json()) as Payload

    const text = (payload.body ?? '').trim()
    if (!text) {
      return new Response(JSON.stringify({ success: true, inserted: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const ticketId = payload.ticket_id ?? null
    const commentId = payload.comment_id ?? null
    const ticketCommentId = payload.ticket_comment_id ?? null

    if (!ticketId && !commentId && !ticketCommentId) {
      return new Response(JSON.stringify({ error: 'ticket_id or comment_id or ticket_comment_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: creator, error: creatorError } = await supabaseAdmin
      .from('omnia_users')
      .select('id')
      .eq('auth_user_id', authData.user.id)
      .single()

    if (creatorError || !creator?.id) {
      return new Response(JSON.stringify({ error: 'Omnia user not found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const mentionedIds = extractMentionedUserIds(text).filter((id) => id !== creator.id)
    if (mentionedIds.length === 0) {
      return new Response(JSON.stringify({ success: true, inserted: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: activeUsers, error: usersError } = await supabaseAdmin
      .from('omnia_users')
      .select('id')
      .in('id', mentionedIds)
      .eq('active', true)

    if (usersError) {
      return new Response(JSON.stringify({ error: usersError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const activeUserIds = (activeUsers ?? []).map((u: { id: string }) => u.id)
    if (activeUserIds.length === 0) {
      return new Response(JSON.stringify({ success: true, inserted: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const rows = activeUserIds.map((user_id: string) => ({
      user_id,
      type: 'mentioned',
      ticket_id: ticketId,
      comment_id: commentId,
      ticket_comment_id: ticketCommentId,
      created_by: creator.id,
    }))

    const { error: insertError } = await supabaseAdmin.from('omnia_notifications').insert(rows)
    if (insertError && insertError.code === '42P01') {
      const legacyRows = activeUserIds.map((user_id: string) => ({
        user_id,
        type: 'mentioned',
        ticket_id: ticketId,
        comment_id: commentId,
        created_by: creator.id,
      }))

      const { error: legacyInsertError } = await supabaseAdmin.from('notifications').insert(legacyRows)
      if (legacyInsertError && legacyInsertError.code !== '23505') {
        return new Response(JSON.stringify({ error: legacyInsertError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ success: true, inserted: rows.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (insertError && insertError.code !== '23505') {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true, inserted: rows.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
