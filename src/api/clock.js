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

export function getNow() {
  const season = getActiveSeason()
  return FROZEN[season] || new Date()
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
