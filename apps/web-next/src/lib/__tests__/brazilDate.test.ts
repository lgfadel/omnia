import { describe, expect, it } from 'vitest'
import { todayInSaoPaulo } from '../brazilDate'

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
