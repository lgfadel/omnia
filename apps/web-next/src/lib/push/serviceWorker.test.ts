import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { expect, it, vi } from 'vitest'

it('displays contextual content supplied by the server', async () => {
  const listeners: Record<string, (event: unknown) => void> = {}
  const showNotification = vi.fn().mockResolvedValue(undefined)
  runInNewContext(readFileSync('public/push-sw.js', 'utf8'), {
    self: { addEventListener: (type: string, callback: (event: unknown) => void) => { listeners[type] = callback }, registration: { showNotification } },
  })
  const pending: Promise<unknown>[] = []
  listeners.push({ data: { json: () => ({ title: 'Tarefa #413 atribuída a você', body: 'Fabio Silva atribuiu a você a tarefa “Revisar contrato”.', notificationId: 'd391b9b0-c33c-421e-81ce-0bb1ff4512a3' }) }, waitUntil: (promise: Promise<unknown>) => pending.push(promise) })
  await Promise.all(pending)
  expect(showNotification).toHaveBeenCalledWith('Tarefa #413 atribuída a você', expect.objectContaining({ body: 'Fabio Silva atribuiu a você a tarefa “Revisar contrato”.', data: { path: '/notificacoes/d391b9b0-c33c-421e-81ce-0bb1ff4512a3' } }))
})
