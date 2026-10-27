export function notificationPath(n: { ticket_id: string | null; ata_id: string | null }): string {
  const valid = (id: string | null) => id && /^[a-zA-Z0-9-]+$/.test(id)
  if (valid(n.ticket_id)) return `/tarefas/${n.ticket_id}`
  if (valid(n.ata_id)) return `/atas/${n.ata_id}`
  return '/'
}
