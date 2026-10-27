self.addEventListener('install', (event) => event.waitUntil(self.skipWaiting()))
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let payload = {}
  try { payload = event.data?.json() || {} } catch { /* use generic notification */ }
  const id = typeof payload.notificationId === 'string' && /^[0-9a-f-]{36}$/i.test(payload.notificationId) ? payload.notificationId : null
  const title = typeof payload.title === 'string' && payload.title.trim() ? payload.title.slice(0, 160) : 'Omnia'
  const body = typeof payload.body === 'string' && payload.body.trim() ? payload.body.slice(0, 400) : 'Abra o Omnia para ver os detalhes da notificação.'
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: '/assets/favicon/web-app-manifest-192x192.png',
    data: { path: id ? `/notificacoes/${id}` : '/' },
    tag: id || undefined,
  }))
})
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const path = event.notification.data?.path || '/'
  const target = new URL(path, self.location.origin)
  if (target.origin !== self.location.origin) return
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const existing = clients.find((client) => new URL(client.url).origin === target.origin)
    if (existing) { await existing.navigate(target.href); return existing.focus() }
    return self.clients.openWindow(target.href)
  })())
})
