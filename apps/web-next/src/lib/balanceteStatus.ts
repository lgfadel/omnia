export type BalanceteStatusColor = 'green' | 'yellow' | 'red' | 'none'

export function parseCompetencia(competencia: string): Date {
  const [month, year] = competencia.split('/')
  return new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1)
}

export function getBalanceteStatus(competencia: string | null): BalanceteStatusColor {
  if (!competencia) return 'none'

  const competenciaDate = parseCompetencia(competencia)
  const now = new Date()
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const diffMs = currentMonth.getTime() - competenciaDate.getTime()
  const diffMonths = Math.round(diffMs / (1000 * 60 * 60 * 24 * 30.44))

  if (diffMonths <= 1) return 'green'
  if (diffMonths === 2) return 'yellow'
  return 'red'
}

export function getBalanceteStatusLabel(status: BalanceteStatusColor): string {
  switch (status) {
    case 'green': return 'Em dia'
    case 'yellow': return 'Atenção'
    case 'red': return 'Atrasado'
    case 'none': return 'Sem balancete'
  }
}

export function getMonthsAgoLabel(competencia: string | null): string {
  if (!competencia) return 'Sem balancete'

  const competenciaDate = parseCompetencia(competencia)
  const now = new Date()
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const diffMs = currentMonth.getTime() - competenciaDate.getTime()
  const diffMonths = Math.round(diffMs / (1000 * 60 * 60 * 24 * 30.44))

  if (diffMonths <= 0) return 'Mês atual'
  if (diffMonths === 1) return '1 mês atrás'
  return `${diffMonths} meses atrás`
}
