import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import { isAllowedPushEndpoint } from './endpoint.ts'
import { formatPushContent, type PushContext } from './content.ts'

type Job = PushContext & { job_id: number; endpoint: string; p256dh: string; auth_key: string; notification_id: string }

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const secret = Deno.env.get('PUSH_WORKER_SECRET')
  const supplied = request.headers.get('x-push-worker-secret')
  if (!secret || !supplied || supplied !== secret) return new Response('Unauthorized', { status: 401 })
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  const subject = Deno.env.get('VAPID_SUBJECT')
  if (!url || !key || !publicKey || !privateKey || !subject) return new Response('Missing configuration', { status: 500 })
  webpush.setVapidDetails(subject, publicKey, privateKey)
  const db = createClient(url, key)
  const { data, error } = await db.rpc('omnia_claim_push_jobs', { batch_size: 10 })
  if (error) { console.error('push claim failed', error.message); return new Response('Queue error', { status: 500 }) }
  let failures = 0
  for (const job of (data ?? []) as Job[]) {
    let result = 'sent'
    let message: string | null = null
    if (!isAllowedPushEndpoint(job.endpoint)) {
      result = 'invalid'
      message = 'Endpoint não permitido'
    } else {
      try {
        await webpush.sendNotification({ endpoint: job.endpoint, keys: { p256dh: job.p256dh, auth: job.auth_key } },
          JSON.stringify({ ...formatPushContent(job), notificationId: job.notification_id }),
          { TTL: 86400, timeout: 10000 })
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode
        result = status === 404 || status === 410 ? 'invalid' : 'retry'
        message = `Push delivery failed${status ? ` (${status})` : ''}`
        failures++
      }
    }
    const finished = await db.rpc('omnia_finish_push_job', { job: job.job_id, result, error_message: message })
    if (finished.error) { failures++; console.error('push completion failed', finished.error.message) }
  }
  console.log(JSON.stringify({ claimed: data?.length ?? 0, failures }))
  return Response.json({ claimed: data?.length ?? 0, failures })
})
