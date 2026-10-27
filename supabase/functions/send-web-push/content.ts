export type PushContext = {
  notification_type: string
  entity_kind?: string | null
  entity_title?: string | null
  task_number?: number | null
  ata_code?: string | null
  actor_name?: string | null
}
const clean = (value: string | null | undefined, limit: number) => {
  const chars = Array.from((value ?? '').replace(/\s+/g, ' ').trim())
  return chars.length > limit ? chars.slice(0, limit - 1).join('') + '…' : chars.join('')
}

export function formatPushContent(context: PushContext): { title: string; body: string } {
  const name = clean(context.entity_title, 180)
  const actor = clean(context.actor_name, 70)
  const task = context.task_number ? `tarefa #${context.task_number}` : 'tarefa'
  const meeting = context.ata_code ? `ata ${clean(context.ata_code, 45)}` : 'ata'
  let title: string
  let body: string
  switch (context.notification_type) {
    case 'assigned':
      title = `${task.charAt(0).toUpperCase()}${task.slice(1)} atribuída a você`
      body = name ? (actor ? `${actor} atribuiu a você a tarefa “${name}”.` : `Você é o novo responsável pela tarefa “${name}”.`) : 'Abra a tarefa no Omnia para ver os detalhes.'
      break
    case 'mentioned':
      title = `Você foi mencionado na ${context.entity_kind === 'task' ? task : meeting}`
      body = name ? `${actor ? `${actor} mencionou você` : 'Você foi mencionado'} em um comentário de “${name}”.` : 'Abra o comentário no Omnia para ver a menção.'
      break
    case 'commented':
      title = `Novo comentário na ${context.entity_kind === 'task' ? task : meeting}`
      body = name ? `${actor ? `${actor} comentou` : 'Um novo comentário foi adicionado'} em “${name}”.` : 'Abra o comentário no Omnia para ver os detalhes.'
      break
    case 'secretary':
      title = `Você é o secretário da ${meeting}`
      body = name ? `Ata: ${name}.` : 'Você foi definido como secretário. Abra a ata no Omnia para ver os detalhes.'
      break
    case 'responsible':
      title = `Você é o responsável pela ${meeting}`
      body = name ? `Ata: ${name}.` : 'Você foi definido como responsável. Abra a ata no Omnia para ver os detalhes.'
      break
    default:
      title = `Atualização na ${context.entity_kind === 'task' ? task : meeting}`
      body = name || 'Abra o Omnia para ver os detalhes da atualização.'
  }
  return { title: clean(title, 120), body: clean(body, 300) }
}
