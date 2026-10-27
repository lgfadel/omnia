import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'

const db = supabase as unknown as SupabaseClient
const ownerKey = 'omnia-push-owner'
export const isIosDevice = (ua: string) => /iPad|iPhone|iPod/i.test(ua)
export function permissionState(input: { supported: boolean; ios: boolean; standalone: boolean; permission: NotificationPermission }) {
  if (input.ios && !input.standalone) return 'install'
  if (!input.supported) return 'unsupported'
  if (input.permission === 'denied') return 'denied'
  return 'ready'
}
export function availability() {
  const ios = isIosDevice(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const standalone = window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  return permissionState({ ios, standalone, supported, permission: supported ? Notification.permission : 'default' })
}
const publicKey = () => {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!key) throw new Error('As notificações push ainda não foram configuradas.')
  const decoded = atob((key + '='.repeat((4 - key.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(decoded, c => c.charCodeAt(0))
}
export async function currentSubscription() {
  if (!('serviceWorker' in navigator)) return null
  const registration = await navigator.serviceWorker.getRegistration('/')
  return registration ? registration.pushManager.getSubscription() : null
}
export async function preparePush() {
  await navigator.serviceWorker.register('/push-sw.js', { scope: '/' })
  // register() may resolve while the first worker is still installing.
  // PushManager.subscribe() requires an active worker.
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Não foi possível preparar as notificações. Reabra o Omnia e tente novamente.')), 15000)
      }),
    ])
  } finally { clearTimeout(timer) }
}
export async function enablePush(userId: string) {
  if (availability() !== 'ready') throw new Error('Notificações indisponíveis neste dispositivo.')
  const key = publicKey()
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Permissão para notificações não concedida.')
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Entre novamente para ativar as notificações.')
  const registration = await preparePush()
  let subscription = await registration.pushManager.getSubscription()
  if (subscription && localStorage.getItem(ownerKey) !== user.id) {
    await subscription.unsubscribe()
    subscription = null
  }
  subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
  const json = subscription.toJSON()
  if (!json.keys?.p256dh || !json.keys.auth) throw new Error('Não foi possível registrar este dispositivo.')
  const { error } = await db.from('omnia_push_subscriptions').upsert({ auth_user_id: user.id, user_id: userId, endpoint: subscription.endpoint, p256dh: json.keys.p256dh, auth_key: json.keys.auth, updated_at: new Date().toISOString() }, { onConflict: 'endpoint' })
  if (error) { await subscription.unsubscribe(); throw new Error('Não foi possível salvar este dispositivo.') }
  localStorage.setItem(ownerKey, user.id)
}
export async function disablePush() {
  const subscription = await currentSubscription()
  if (!subscription) { localStorage.removeItem(ownerKey); return }
  try {
    const { error } = await db.from('omnia_push_subscriptions').delete().eq('endpoint', subscription.endpoint)
    if (error) throw new Error('Não foi possível remover o registro do dispositivo.')
  } finally {
    try { await subscription.unsubscribe() } finally { localStorage.removeItem(ownerKey) }
  }
}
export async function reconcilePush(userId: string, authId: string) {
  const subscription = await currentSubscription()
  if (!subscription) return
  if (localStorage.getItem(ownerKey) !== authId) { await subscription.unsubscribe(); return }
  if (Notification.permission === 'granted') await enablePush(userId)
  else await disablePush()
}
