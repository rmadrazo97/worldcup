import { useEffect, useMemo, useRef } from 'react'
import { formatShortDate } from '../api/clock.js'

// ─────────── Tournament dates: build the date strip ───────────
// June 11 – July 19, 2026. We pre-compute the strip with day-of-week labels
// and which days have live matches.
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

export default function DateStrip({ matches, todayIso, selectedIso, onSelect }) {
  const stripRef = useRef(null)
  const liveByDay = useMemo(() => {
    const set = new Set()
    matches.forEach(m => {
      if (m.status === 'LIVE' || m.status === 'HT') set.add(dateKey(m))
    })
    return set
  }, [matches])

  const matchesByDay = useMemo(() => {
    const counts = {}
    matches.forEach(m => {
      const k = dateKey(m)
      if (!k) return
      counts[k] = (counts[k] || 0) + 1
    })
    return counts
  }, [matches])

  // Compute the month label from whatever is centered/selected.
  const monthLabel = useMemo(() => {
    const target = selectedIso || todayIso
    const d = TOURNAMENT_DAYS.find(x => x.iso === target)
    if (!d) return 'June'
    return d.month === 'Jun' ? 'June' : d.month === 'Jul' ? 'July' : d.month
  }, [selectedIso, todayIso])

  useEffect(() => {
    // Scroll the active pill into view when it changes.
    const target = selectedIso || todayIso
    const el = stripRef.current?.querySelector(`[data-iso="${cssEscape(target)}"]`)
    if (el) {
      el.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
    }
  }, [selectedIso, todayIso])

  const scrollBy = (dx) => {
    stripRef.current?.scrollBy({ left: dx, behavior: 'smooth' })
  }

  const todayIdx = TOURNAMENT_DAYS.findIndex(x => x.iso === todayIso)

  return (
    <div className="date-strip-wrap">
      <div className="date-strip-head">
        <div className="date-strip-month">{monthLabel} <span className="year">2026</span></div>
        <div className="date-nav">
          {selectedIso && selectedIso !== todayIso && (
            <button
              type="button"
              className="date-jump-today"
              onClick={() => onSelect && onSelect(null)}
              aria-label="Jump to today"
            >
              Today
            </button>
          )}
          <button onClick={() => scrollBy(-240)} aria-label="Previous days" type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <button onClick={() => scrollBy(240)} aria-label="Next days" type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </div>
      </div>
      <div className="date-strip" ref={stripRef} role="tablist" aria-label="Tournament days">
        {TOURNAMENT_DAYS.map(d => {
          const isToday = d.iso === todayIso
          const myIdx = TOURNAMENT_DAYS.findIndex(x => x.iso === d.iso)
          const isPast = todayIdx >= 0 && myIdx < todayIdx
          const hasLive = liveByDay.has(d.iso)
          const isSelected = selectedIso ? d.iso === selectedIso : isToday
          const matchCount = matchesByDay[d.iso] || 0
          return (
            <button
              key={d.iso}
              type="button"
              role="tab"
              data-iso={d.iso}
              aria-selected={isSelected}
              aria-current={isToday ? 'date' : undefined}
              aria-label={`${d.month} ${d.num}, ${d.dow}${matchCount ? ` — ${matchCount} match${matchCount === 1 ? '' : 'es'}` : ' — no matches'}${hasLive ? ', live now' : ''}`}
              className={
                'date-pill' +
                (isToday ? ' is-today' : '') +
                (isPast && !isSelected ? ' is-past' : '') +
                (hasLive ? ' has-live' : '') +
                (isSelected && !isToday ? ' is-selected' : '') +
                (matchCount === 0 ? ' is-empty' : '')
              }
              onClick={() => onSelect && onSelect(isToday ? null : d.iso)}
            >
              <span className="d-num">{d.num}</span>
              <span className="d-day">{d.dow}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Quote a value for use in a CSS attribute selector — tournament keys are
// safe ("Jun 19"), but defending against unexpected input is cheap.
function cssEscape(s) {
  return String(s || '').replace(/"/g, '\\"')
}
