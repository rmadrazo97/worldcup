import { useEffect, useMemo, useRef } from 'react'
import { formatShortDate } from '../api/clock.js'

// ─────────── Tournament dates: build the date strip ───────────
// June 11 – July 19, 2026. We pre-compute the strip with day-of-week labels
// and which days have live matches. "Today" is June 19.
const TOURNAMENT_DAYS = (() => {
  const out = []
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const dows = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  // Jun 11 2026 is a Thursday
  const start = new Date(2026, 5, 11)
  for (let i = 0; i < 39; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    out.push({
      iso: `${months[d.getMonth()]} ${d.getDate()}`,
      num: d.getDate(),
      dow: dows[d.getDay()],
      month: months[d.getMonth()],
    })
  }
  return out
})()

const dateKey = (m) => {
  if (!m?.kickoff_iso) return ''
  try { return formatShortDate(new Date(m.kickoff_iso)) } catch { return '' }
}

export default function DateStrip({ matches, todayIso }) {
  const stripRef = useRef(null)
  const liveByDay = useMemo(() => {
    const set = new Set()
    matches.forEach(m => {
      if (m.status === 'LIVE' || m.status === 'HT') set.add(dateKey(m))
    })
    return set
  }, [matches])

  useEffect(() => {
    // Scroll today into view on mount
    const todayEl = stripRef.current?.querySelector('.date-pill.is-today')
    if (todayEl) {
      todayEl.scrollIntoView({ block: 'nearest', inline: 'center' })
    }
  }, [])

  const scrollBy = (dx) => {
    stripRef.current?.scrollBy({ left: dx, behavior: 'smooth' })
  }

  return (
    <div className="date-strip-wrap">
      <div className="date-strip-head">
        <div className="date-strip-month">June <span className="year">2026</span></div>
        <div className="date-nav">
          <button onClick={() => scrollBy(-240)} aria-label="Previous days">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <button onClick={() => scrollBy(240)} aria-label="Next days">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </div>
      </div>
      <div className="date-strip" ref={stripRef}>
        {TOURNAMENT_DAYS.map(d => {
          const isToday = d.iso === todayIso
          const todayIdx = TOURNAMENT_DAYS.findIndex(x => x.iso === todayIso)
          const myIdx = TOURNAMENT_DAYS.findIndex(x => x.iso === d.iso)
          const isPast = myIdx < todayIdx
          const hasLive = liveByDay.has(d.iso)
          return (
            <div
              key={d.iso}
              className={
                'date-pill' +
                (isToday ? ' is-today' : '') +
                (isPast ? ' is-past' : '') +
                (hasLive ? ' has-live' : '')
              }
            >
              <span className="d-num">{d.num}</span>
              <span className="d-day">{d.dow}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
