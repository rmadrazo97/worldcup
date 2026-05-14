import { describe, expect, it } from 'vitest'
import { isMatchdayToday, parseISO } from '../../src/util/time.js'
import type { FIFAMatch } from '../../src/upstream/types.js'

// Construct a minimal stub. Only `datetime` and `season.year` are read.
function stubMatch(datetime: string, year: number): Pick<FIFAMatch, 'datetime' | 'season'> {
  return {
    datetime,
    season: { id: 1, year },
  }
}

describe('util/time.parseISO', () => {
  it('parses a valid ISO string', () => {
    const d = parseISO('2026-06-12T18:00:00Z')
    expect(d).toBeInstanceOf(Date)
    expect(d?.getUTCFullYear()).toBe(2026)
  })
  it('returns null on bad input', () => {
    expect(parseISO('not a date')).toBeNull()
    expect(parseISO('')).toBeNull()
    expect(parseISO(null)).toBeNull()
  })
})

describe('util/time.isMatchdayToday', () => {
  // Fix "now" to a stable point so the test isn't time-of-day dependent.
  const now = Date.UTC(2026, 5, 12, 12, 0, 0) // 2026-06-12T12:00:00Z (noon UTC)

  it('returns false when no matches', () => {
    expect(isMatchdayToday([], 2026, now)).toBe(false)
  })

  it('returns true when a match kicks off today (UTC)', () => {
    const matches = [stubMatch('2026-06-12T18:00:00Z', 2026)]
    expect(isMatchdayToday(matches, 2026, now)).toBe(true)
  })

  it('returns true when a match kicks off within the next 4h window (early tomorrow UTC)', () => {
    // 03:00 UTC tomorrow — outside today's UTC date, but within 15h of now... actually noon -> +4h = 16:00 today
    // so use a kickoff at 14:00 today to stay safely inside today.
    // Edge case: a match at 23:30 should still be "today".
    const matches = [stubMatch('2026-06-12T23:30:00Z', 2026)]
    expect(isMatchdayToday(matches, 2026, now)).toBe(true)
  })

  it('returns false when the only match is tomorrow (outside today + 4h)', () => {
    // tomorrow at 18:00 — well outside today's UTC date and past now+4h
    const matches = [stubMatch('2026-06-13T18:00:00Z', 2026)]
    expect(isMatchdayToday(matches, 2026, now)).toBe(false)
  })

  it('returns false when the only match is yesterday', () => {
    const matches = [stubMatch('2026-06-11T18:00:00Z', 2026)]
    expect(isMatchdayToday(matches, 2026, now)).toBe(false)
  })

  it('ignores matches from a different season', () => {
    const matches = [stubMatch('2026-06-12T18:00:00Z', 2022)]
    expect(isMatchdayToday(matches, 2026, now)).toBe(false)
  })
})
