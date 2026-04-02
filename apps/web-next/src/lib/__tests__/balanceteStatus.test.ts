import { describe, expect, it } from 'vitest'

import { getBalanceteStatus, getMonthsAgoLabel } from '../balanceteStatus'

describe('balanceteStatus', () => {
  it('classifica o mês atual como em dia', () => {
    expect(getBalanceteStatus('04/2026', new Date('2026-04-10T12:00:00Z'))).toBe('green')
  })

  it('mantém fevereiro em dia até 15 de abril', () => {
    expect(getBalanceteStatus('02/2026', new Date('2026-04-15T12:00:00Z'))).toBe('green')
  })

  it('move fevereiro para atenção após 15 de abril', () => {
    expect(getBalanceteStatus('02/2026', new Date('2026-04-16T12:00:00Z'))).toBe('yellow')
  })

  it('mantém janeiro em atenção até 15 de abril', () => {
    expect(getBalanceteStatus('01/2026', new Date('2026-04-15T12:00:00Z'))).toBe('yellow')
  })

  it('marca janeiro como atrasado após 15 de abril', () => {
    expect(getBalanceteStatus('01/2026', new Date('2026-04-16T12:00:00Z'))).toBe('red')
  })

  it('retorna sem balancete quando não há competência', () => {
    expect(getBalanceteStatus(null, new Date('2026-04-16T12:00:00Z'))).toBe('none')
  })

  it('trata virada de ano corretamente', () => {
    expect(getBalanceteStatus('11/2025', new Date('2026-01-14T12:00:00Z'))).toBe('green')
    expect(getBalanceteStatus('11/2025', new Date('2026-01-16T12:00:00Z'))).toBe('yellow')
    expect(getBalanceteStatus('10/2025', new Date('2026-01-14T12:00:00Z'))).toBe('yellow')
    expect(getBalanceteStatus('10/2025', new Date('2026-01-16T12:00:00Z'))).toBe('red')
  })

  it('mantém o label de defasagem coerente com a régua operacional', () => {
    expect(getMonthsAgoLabel('02/2026', new Date('2026-04-02T12:00:00Z'))).toBe('Em dia')
    expect(getMonthsAgoLabel('01/2026', new Date('2026-04-02T12:00:00Z'))).toBe('2 meses atrás')
    expect(getMonthsAgoLabel('01/2026', new Date('2026-04-16T12:00:00Z'))).toBe('3 meses atrás')
  })
})
