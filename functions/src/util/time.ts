// Time helpers. Kept as named exports rather than methods on a class so
// tests can monkey-patch / stub the individual pieces (e.g. `nowMs`)
// without dragging in a full clock abstraction.

import type { FIFAMatch } from '../upstream/types.js'

/** Wall-clock now in epoch ms. Extracted so tests can mock. */
export function nowMs(): number {
  return Date.now()
}

/** Parse an ISO-8601 string into a Date, returning null on bad input. */
export function parseISO(s: string | null | undefined): Date | null {
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

const MS_PER_HOUR = 60 * 60 * 1000
const MS_PER_DAY = 24 * MS_PER_HOUR

function startOfUtcDay(t: number): number {
  const d = new Date(t)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

/**
 * Returns true if any match in `matches` belonging to `season` kicks off
 * within today's UTC date OR within the next 4 hours (whichever is later).
 * The "+ 4h" rolls today's matchday into early-tomorrow-UTC kickoffs that
 * still count as "live tonight" from the operator's point of view.
 */
export function isMatchdayToday(
  matches: ReadonlyArray<Pick<FIFAMatch, 'datetime' | 'season'>>,
  season: number,
  now: number = nowMs(),
): boolean {
  const dayStart = startOfUtcDay(now)
  const dayEnd = dayStart + MS_PER_DAY
  const horizon = Math.max(dayEnd, now + 4 * MS_PER_HOUR)

  for (const m of matches) {
    if (m.season?.year !== season) continue
    const t = parseISO(m.datetime)?.getTime()
    if (t == null) continue
    if (t >= dayStart && t < horizon) return true
  }
  return false
}
