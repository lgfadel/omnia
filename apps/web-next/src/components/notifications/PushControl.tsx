'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth.store'
import { availability, currentSubscription, disablePush, enablePush, reconcilePush } from '@/lib/push/subscription'

export function PushControl() {
  const profile = useAuthStore(s => s.userProfile)
  const user = useAuthStore(s => s.user)
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const [state, setState] = useState('unsupported')
  useEffect(() => {
    setState(availability())
    if (!profile?.id || !user?.id) return
    let cancelled = false
    void (async () => {
      try {
        await reconcilePush(profile.id, user.id)
        const sub = await currentSubscription()
        if (!cancelled) setEnabled(Boolean(sub))
      } catch { if (!cancelled) { setFailed(true); setMessage('Não foi possível verificar as notificações neste dispositivo.') } }
    })()
    return () => { cancelled = true }
  }, [profile?.id, user?.id])
  async function toggle() {
    if (!profile?.id) return
    setBusy(true); setMessage(''); setFailed(false)
    try {
      if (enabled) await disablePush()
      else await enablePush(profile.id)
      setEnabled(!enabled)
      setMessage(enabled ? 'Push desativado neste dispositivo.' : 'Push ativado neste dispositivo.')
    } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : 'Não foi possível alterar as notificações.') }
    finally { setBusy(false); setState(availability()) }
  }
  return <div className="px-2 py-2 text-sm" onClick={event => event.stopPropagation()}>
    {state === 'install' ? <p>Para receber notificações no iPhone, adicione o Omnia à Tela de Início pelo menu Compartilhar e abra-o pelo ícone.</p> :
      state === 'denied' ? <p>As notificações estão bloqueadas. Altere a permissão nas configurações do navegador ou do dispositivo.</p> :
      state === 'unsupported' ? <p>Notificações push não disponíveis neste navegador.</p> :
      <Button variant="outline" size="sm" onClick={toggle} disabled={busy || !profile?.id}>{enabled ? 'Desativar push neste dispositivo' : 'Ativar push neste dispositivo'}</Button>}
    {message && <p role="status" className={`mt-2 ${failed ? 'text-destructive' : 'text-muted-foreground'}`}>{message}</p>}
  </div>
}
