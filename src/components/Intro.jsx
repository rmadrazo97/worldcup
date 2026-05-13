import { formatShortDate, getUserTimezoneAbbr } from '../api/clock.js'

const dateKey = (m) => {
  if (!m?.kickoff_iso) return ''
  try { return formatShortDate(new Date(m.kickoff_iso)) } catch { return '' }
}

export default function Intro({ matches, todayIso, eyebrow }) {
  const liveCount = matches.filter(m => m.status === 'LIVE' || m.status === 'HT').length
  const todayCount = matches.filter(m => dateKey(m) === todayIso).length
  const tz = getUserTimezoneAbbr()
  return (
    <div className="intro">
      <span className="intro-eyebrow">{eyebrow}</span>
      <h1 className="intro-title">Live scores &amp; fixtures.</h1>
      <div className="intro-meta">
        <span className="now-dot" />
        <span>{liveCount} live now · {todayCount} matches today</span>
        {tz && <span className="intro-tz" title="All kickoff times shown in your local timezone">· times in {tz}</span>}
      </div>
    </div>
  )
}
