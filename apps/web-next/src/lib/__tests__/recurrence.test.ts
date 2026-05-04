import { describe, expect, it } from 'vitest'
import {
  addRecurrenceInterval,
  canGenerateOccurrence,
  getNextOccurrenceDate,
  normalizeDateOnly,
} from '../recurrence'

describe('recurrence utilities', () => {
  it('adds daily, weekly, and monthly intervals', () => {
    expect(addRecurrenceInterval(new Date('2026-05-04T00:00:00'), 'DAILY', 2)).toEqual(new Date('2026-05-06T00:00:00'))
    expect(addRecurrenceInterval(new Date('2026-05-04T00:00:00'), 'WEEKLY', 2)).toEqual(new Date('2026-05-18T00:00:00'))
    expect(addRecurrenceInterval(new Date('2026-01-31T00:00:00'), 'MONTHLY', 1)).toEqual(new Date('2026-02-28T00:00:00'))
  })

  it('calculates the next occurrence date from the current due date', () => {
    const nextDate = getNextOccurrenceDate({
      currentDueDate: new Date('2026-05-04T00:00:00'),
      frequency: 'WEEKLY',
      interval: 3,
    })

    expect(nextDate).toEqual(new Date('2026-05-25T00:00:00'))
  })

  it('does not generate when the next date is after the end date', () => {
    expect(canGenerateOccurrence({
      nextOccurrenceDate: new Date('2026-06-01T00:00:00'),
      endType: 'ON_DATE',
      endDate: new Date('2026-05-31T00:00:00'),
      generatedOccurrences: 3,
    })).toBe(false)
  })

  it('does not generate when the occurrence limit was reached', () => {
    expect(canGenerateOccurrence({
      nextOccurrenceDate: new Date('2026-05-11T00:00:00'),
      endType: 'AFTER_COUNT',
      occurrenceLimit: 4,
      generatedOccurrences: 4,
    })).toBe(false)
  })

  it('allows never-ending recurrence when no limit is configured', () => {
    expect(canGenerateOccurrence({
      nextOccurrenceDate: new Date('2026-05-11T00:00:00'),
      endType: 'NEVER',
      generatedOccurrences: 99,
    })).toBe(true)
  })

  it('normalizes dates to local date-only values', () => {
    expect(normalizeDateOnly(new Date('2026-05-04T18:45:00'))).toEqual(new Date('2026-05-04T00:00:00'))
  })
})
