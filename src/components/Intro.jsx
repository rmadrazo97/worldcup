import { formatShortDate, getUserTimezoneAbbr } from '../api/clock.js'

const dateKey = (m) => {
  if (!m?.kickoff_iso) return ''
  try { return formatShortDate(new Date(m.kickoff_iso)) } catch { return '' }
}

export default function Intro({ matches, todayIso, activeDateIso, eyebrow }) {
  const liveCount = matches.filter(m => m.status === 'LIVE' || m.status === 'HT').length
  const viewKey = activeDateIso || todayIso
  const viewCount = matches.filter(m => dateKey(m) === viewKey).length
  const isToday = viewKey === todayIso
  const tz = getUserTimezoneAbbr()
  return (
    <div className="intro">
      <span className="intro-eyebrow">{eyebrow}</span>
      <h1 className="intro-title">Live scores &amp; fixtures.</h1>
      <div className="intro-meta">
        {liveCount > 0 ? <span className="now-dot" aria-hidden="true" /> : null}
        <span>
          {liveCount > 0 ? <><strong>{liveCount}</strong> live now</> : 'No matches live'}
          <span className="intro-sep"> · </span>
          {viewCount} match{viewCount === 1 ? '' : 'es'} {isToday ? 'today' : `on ${viewKey}`}
          {tz && <>
            <span className="intro-sep"> · </span>
            <span className="intro-tz" title="All kickoff times shown in your local timezone">times in {tz}</span>
          </>}
        </span>
      </div>
    </div>
  )
}
