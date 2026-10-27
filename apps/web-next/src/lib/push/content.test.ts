import { describe, expect, it } from 'vitest'
import { formatPushContent } from '../../../../../supabase/functions/send-web-push/content'

describe('push content', () => {
  it('identifies an assigned task and who assigned it', () => {
    const result = formatPushContent({ notification_type: 'assigned', task_number: 413, entity_kind: 'task', entity_title: 'Revisar contrato', actor_name: 'Fabio Silva' })
    expect(result).toEqual({ title: 'Tarefa #413 atribuída a você', body: 'Fabio Silva atribuiu a você a tarefa “Revisar contrato”.' })
  })
  it('explains mentions in tasks and meetings', () => {
    expect(formatPushContent({ notification_type: 'mentioned', task_number: 413, entity_kind: 'task', entity_title: 'Revisar contrato', actor_name: 'Fabio Silva' })).toEqual({ title: 'Você foi mencionado na tarefa #413', body: 'Fabio Silva mencionou você em um comentário de “Revisar contrato”.' })
    expect(formatPushContent({ notification_type: 'mentioned', entity_kind: 'ata', entity_title: 'Assembleia de outubro' }).body).toContain('Você foi mencionado')
  })
  it('identifies new comments on tasks and meetings', () => {
    expect(formatPushContent({ notification_type: 'commented', task_number: 413, entity_kind: 'task', entity_title: 'Revisar contrato', actor_name: 'Fabio Silva' })).toEqual({ title: 'Novo comentário na tarefa #413', body: 'Fabio Silva comentou em “Revisar contrato”.' })
    expect(formatPushContent({ notification_type: 'commented', entity_kind: 'ata', entity_title: 'Assembleia de outubro', actor_name: 'Fabio Silva' })).toEqual({ title: 'Novo comentário na ata', body: 'Fabio Silva comentou em “Assembleia de outubro”.' })
  })
  it('explains meeting responsibilities', () => {
    expect(formatPushContent({ notification_type: 'secretary', entity_kind: 'ata', entity_title: 'Assembleia de outubro' })).toEqual({ title: 'Você é o secretário da ata', body: 'Ata: Assembleia de outubro.' })
    expect(formatPushContent({ notification_type: 'responsible', entity_kind: 'ata', entity_title: 'Assembleia de outubro' }).title).toBe('Você é o responsável pela ata')
  })
  it('handles unavailable context without inventing details and bounds long text', () => {
    expect(formatPushContent({ notification_type: 'assigned', entity_kind: 'task' })).toEqual({ title: 'Tarefa atribuída a você', body: 'Abra a tarefa no Omnia para ver os detalhes.' })
    const result = formatPushContent({ notification_type: 'assigned', entity_title: 'Nome '.repeat(1000), actor_name: 'Autor '.repeat(100) })
    expect([...result.body].length).toBeLessThanOrEqual(300)
  })
})
