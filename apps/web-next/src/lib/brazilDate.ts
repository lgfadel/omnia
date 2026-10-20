const SAO_PAULO_DATE_FORMAT = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: 'America/Sao_Paulo',
})

/** Data de hoje no calendário de Brasília (YYYY-MM-DD), independente do fuso do navegador/servidor. */
export function todayInSaoPaulo(now: Date = new Date()): string {
  return SAO_PAULO_DATE_FORMAT.format(now)
}

const SAO_PAULO_DATE_TIME_FORMAT = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'America/Sao_Paulo',
})

/** Data e hora no horário de Brasília ("20/10/2026 às 14:32"), independente do fuso do navegador/servidor. */
export function formatDateTimeInSaoPaulo(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const parts = Object.fromEntries(
    SAO_PAULO_DATE_TIME_FORMAT.formatToParts(date).map(({ type, value: v }) => [type, v]),
  )
  return `${parts.day}/${parts.month}/${parts.year} às ${parts.hour}:${parts.minute}`
}
