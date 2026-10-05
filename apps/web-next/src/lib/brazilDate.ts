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
