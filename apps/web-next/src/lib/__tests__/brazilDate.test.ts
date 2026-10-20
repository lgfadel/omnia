import { describe, expect, it } from 'vitest'
import { formatDateTimeInSaoPaulo, todayInSaoPaulo } from '../brazilDate'

describe('todayInSaoPaulo', () => {
  it('devolve a data local de São Paulo no formato YYYY-MM-DD', () => {
    expect(todayInSaoPaulo(new Date('2026-10-05T15:00:00Z'))).toBe('2026-10-05')
  })

  it('nao avanca o dia depois das 21h (UTC ja virou, Brasil ainda nao)', () => {
    // 22:30 em Brasília = 01:30 UTC do dia seguinte
    expect(todayInSaoPaulo(new Date('2026-10-06T01:30:00Z'))).toBe('2026-10-05')
  })

  it('vira o dia na meia-noite de Brasília', () => {
    expect(todayInSaoPaulo(new Date('2026-10-06T03:00:00Z'))).toBe('2026-10-06')
  })
})

describe('formatDateTimeInSaoPaulo', () => {
  it('mostra data e hora no horário de Brasília', () => {
    expect(formatDateTimeInSaoPaulo('2026-10-06T17:32:00Z')).toBe('06/10/2026 às 14:32')
  })

  it('usa o dia de Brasília quando o UTC já virou', () => {
    expect(formatDateTimeInSaoPaulo(new Date('2026-10-06T01:30:00Z'))).toBe('05/10/2026 às 22:30')
  })

  it('mostra meia-noite como 00:00', () => {
    expect(formatDateTimeInSaoPaulo('2026-10-06T03:05:00Z')).toBe('06/10/2026 às 00:05')
  })

  it('devolve vazio para data inválida', () => {
    expect(formatDateTimeInSaoPaulo('não é data')).toBe('')
  })
})
