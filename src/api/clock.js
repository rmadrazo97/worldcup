// Single source of "now" for the app.
//
// In production (season === 2026) `getNow()` returns the wall clock. For the
// historical seasons we freeze "now" at the moment of the final whistle so
// the UI shows the tournament as just-completed (all matches "FT", etc.).

import { getActiveSeason } from './season.js'

const FROZEN = {
  2018: new Date('2018-07-15T18:00:00Z'),
  2022: new Date('2022-12-18T18:00:00Z'),
}

// The 2026 tournament window. Used to clamp the "selected day" so that
// the date strip + feed default to a real tournament day whenever the
// wall clock is outside the window (e.g. visiting before kickoff).
const TOURNAMENT_2026_START = new Date(2026, 5, 11)               // Jun 11, 2026
const TOURNAMENT_2026_END   = new Date(2026, 6, 19, 23, 59, 59)   // Jul 19, 2026

export function getNow() {
  const season = getActiveSeason()
  return FROZEN[season] || new Date()
}

// Returns the date the UI should treat as "today" for date-strip selection
// and the default feed. Historical seasons are already pinned to their
// final day via FROZEN; 2026 clamps to the tournament window.
export function getTournamentToday() {
  const now = getNow()
  if (getActiveSeason() !== 2026) return now
  if (now < TOURNAMENT_2026_START) return new Date(TOURNAMENT_2026_START)
  if (now > TOURNAMENT_2026_END)   return new Date(TOURNAMENT_2026_END)
  return now
}

export const TOURNAMENT_WINDOW = { start: TOURNAMENT_2026_START, end: TOURNAMENT_2026_END }

// Browser-local time-zone abbreviation, e.g. "EDT", "PT", "CET". Used to
// tell viewers that all match times displayed are in their own zone, not
// venue-local or UTC. Returns "" if Intl can't determine one (rare).
export function getUserTimezoneAbbr() {
  try {
    const parts = new Intl.DateTimeFormat([], { timeZoneName: 'short' }).formatToParts(new Date())
    return parts.find(p => p.type === 'timeZoneName')?.value || ''
  } catch {
    return ''
  }
}

// Format a kickoff time in the user's local timezone with the zone
// abbreviation appended, e.g. "9:00 PM EDT". Falls back to the bare time
// if the zone can't be resolved.
export function formatKickoffWithZone(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    const zone = getUserTimezoneAbbr()
    return zone ? `${time} ${zone}` : time
  } catch {
    return ''
  }
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DOWS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DOWS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Match the "Jun 19" key format used by mock match dates.
export function formatShortDate(date) {
  return `${MONTHS_SHORT[date.getMonth()]} ${date.getDate()}`
}

// Eyebrow copy, e.g. "Friday, June 19".
export function formatLongEyebrow(date) {
  return `${DOWS_LONG[date.getDay()]}, ${MONTHS_LONG[date.getMonth()]} ${date.getDate()}`
}

// Same-day check using local-time year/month/day (avoids UTC drift across zones).
export function isSameLocalDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export { MONTHS_SHORT, MONTHS_LONG, DOWS_SHORT, DOWS_LONG }
