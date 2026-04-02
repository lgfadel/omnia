export type BalanceteStatusColor = 'green' | 'yellow' | 'red' | 'none'

export function parseCompetencia(competencia: string): Date {
  const [month, year] = competencia.split('/')
  return new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1)
}

function getMonthDifference(competenciaDate: Date, referenceDate: Date): number {
  return (
    (referenceDate.getFullYear() - competenciaDate.getFullYear()) * 12 +
    (referenceDate.getMonth() - competenciaDate.getMonth())
  )
}

function getOperationalReferenceMonth(referenceDate: Date): Date {
  const monthOffset = referenceDate.getDate() <= 15 ? -2 : -1
  return new Date(referenceDate.getFullYear(), referenceDate.getMonth() + monthOffset, 1)
}

function getOperationalLagMonths(competenciaDate: Date, referenceDate: Date): number {
  return getMonthDifference(competenciaDate, getOperationalReferenceMonth(referenceDate))
}

export function getBalanceteStatus(
  competencia: string | null,
  referenceDate: Date = new Date(),
): BalanceteStatusColor {
  if (!competencia) return 'none'

  const competenciaDate = parseCompetencia(competencia)
  const diffMonths = getOperationalLagMonths(competenciaDate, referenceDate)

  if (diffMonths <= 0) return 'green'
  if (diffMonths === 1) return 'yellow'
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

export function getMonthsAgoLabel(
  competencia: string | null,
  referenceDate: Date = new Date(),
): string {
  if (!competencia) return 'Sem balancete'

  const competenciaDate = parseCompetencia(competencia)
  const diffMonths = getOperationalLagMonths(competenciaDate, referenceDate)
  const displayMonths = diffMonths + 1

  if (diffMonths <= 0) return 'Em dia'
  if (displayMonths === 1) return '1 mês atrás'
  return `${displayMonths} meses atrás`
}
