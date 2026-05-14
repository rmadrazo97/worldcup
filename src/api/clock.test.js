import { describe, expect, it } from 'vitest'
import { formatLongEyebrow, formatShortDate, getNow, isSameLocalDay } from './clock.js'

describe('clock helpers', () => {
  const d = new Date(2026, 5, 19, 16, 31)

  it('formatShortDate matches the "Mon D" format used as match-date keys', () => {
    expect(formatShortDate(d)).toBe('Jun 19')
  })

  it('formatLongEyebrow renders "Weekday, Month D"', () => {
    expect(formatLongEyebrow(d)).toBe('Friday, June 19')
  })

  it('isSameLocalDay compares local Y/M/D, ignoring time', () => {
    expect(isSameLocalDay(new Date(2026, 5, 19, 0, 0), new Date(2026, 5, 19, 23, 59))).toBe(true)
    expect(isSameLocalDay(new Date(2026, 5, 19, 0, 0), new Date(2026, 5, 20, 0, 0))).toBe(false)
  })

  it('getNow returns a Date during mock mode', () => {
    const now = getNow()
    expect(now).toBeInstanceOf(Date)
  })
})
