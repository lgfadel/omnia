export type RecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY'
export type RecurrenceEndType = 'NEVER' | 'ON_DATE' | 'AFTER_COUNT'

type NextOccurrenceInput = {
  currentDueDate: Date
  frequency: RecurrenceFrequency
  interval: number
}

type CanGenerateOccurrenceInput = {
  nextOccurrenceDate: Date
  endType: RecurrenceEndType
  endDate?: Date
  occurrenceLimit?: number
  generatedOccurrences: number
}

export function normalizeDateOnly(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate()
}

export function addRecurrenceInterval(date: Date, frequency: RecurrenceFrequency, interval: number) {
  const normalizedDate = normalizeDateOnly(date)
  const safeInterval = Math.max(1, interval)

  if (frequency === 'DAILY') {
    const nextDate = new Date(normalizedDate)
    nextDate.setDate(nextDate.getDate() + safeInterval)
    return nextDate
  }

  if (frequency === 'WEEKLY') {
    const nextDate = new Date(normalizedDate)
    nextDate.setDate(nextDate.getDate() + safeInterval * 7)
    return nextDate
  }

  const targetMonth = normalizedDate.getMonth() + safeInterval
  const targetYear = normalizedDate.getFullYear() + Math.floor(targetMonth / 12)
  const targetMonthIndex = targetMonth % 12
  const targetDay = Math.min(
    normalizedDate.getDate(),
    daysInMonth(targetYear, targetMonthIndex),
  )

  return new Date(targetYear, targetMonthIndex, targetDay)
}

export function getNextOccurrenceDate(input: NextOccurrenceInput) {
  return addRecurrenceInterval(input.currentDueDate, input.frequency, input.interval)
}

export function canGenerateOccurrence(input: CanGenerateOccurrenceInput) {
  if (input.endType === 'ON_DATE' && input.endDate) {
    return normalizeDateOnly(input.nextOccurrenceDate) <= normalizeDateOnly(input.endDate)
  }

  if (input.endType === 'AFTER_COUNT' && input.occurrenceLimit !== undefined) {
    return input.generatedOccurrences < input.occurrenceLimit
  }

  return true
}
