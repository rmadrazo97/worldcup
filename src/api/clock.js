// Single source of "now" for the app.
//
// While the data layer is on mock fixtures, "now" is frozen at the same
// instant the mock data is keyed around (Fri Jun 19, 2026, 4:31 PM local).
// When the live API is wired, swap getNow() to `() => new Date()` and remove
// the MOCK_NOW constant.

const MOCK_NOW = new Date(2026, 5, 19, 16, 31)

export function getNow() {
  return MOCK_NOW
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
