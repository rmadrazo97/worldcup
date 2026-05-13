import { Link } from 'react-router-dom'
import { Flag } from './Flag.jsx'
import { useTeam } from '../api/providers.jsx'

export default function LiveCard({ match, venues }) {
  const home = useTeam(match.home)
  const away = useTeam(match.away)
  const venueLabel = (venues && venues[match.venueShort]) || match.venueShort || ''
  const isHT = match.status === 'HT'
  // minute may be null on a LIVE match — render empty so the "Live" dot in
  // live-status carries the only label rather than duplicating it.
  const minuteLabel = match.minute || (isHT ? 'HT' : '')
  return (
    <Link
      to={`/match/${match.id}`}
      className="live-card"
      aria-label={`${home?.name || match.home} ${match.hs} — ${match.as} ${away?.name || match.away}, ${isHT ? 'half time' : 'live'}${minuteLabel ? `, minute ${minuteLabel}` : ''}`}
    >
      <div className="live-card-top">
        <span className="live-card-group">Group {match.group}{match.md ? ` · MD${match.md}` : ''}</span>
        <span className="live-card-venue">{venueLabel}</span>
      </div>
      <div className="live-card-body">
        <div className="live-team">
          <span className="crest"><Flag team={match.home} size="lg" /></span>
          <span className="name">{home.name}</span>
        </div>
        <div className="live-score">
          <span>{match.hs}</span>
          <span className="sep">–</span>
          <span>{match.as}</span>
        </div>
        <div className="live-team">
          <span className="crest"><Flag team={match.away} size="lg" /></span>
          <span className="name">{away.name}</span>
        </div>
      </div>
      <div className="live-card-foot">
        <span className="live-status">
          <span className="live-dot" aria-hidden="true" />
          <span>{isHT ? 'Half time' : 'Live'}</span>
        </span>
        <span className="live-minute">{minuteLabel}</span>
      </div>
    </Link>
  )
}

export function LiveSection({ matches, venues, onJumpToFeed }) {
  const live = matches.filter(m => m.status === 'LIVE' || m.status === 'HT')
  if (live.length === 0) return null
  return (
    <section className="section">
      <div className="section-head">
        <h2 className="section-title">
          Live now
          <span className="badge-count">{live.length}</span>
        </h2>
        {onJumpToFeed && (
          <button type="button" className="section-aux" onClick={onJumpToFeed}>
            All matches <span aria-hidden="true">↓</span>
          </button>
        )}
      </div>
      <div className="live-grid">
        {live.map(m => <LiveCard key={m.id} match={m} venues={venues} />)}
      </div>
    </section>
  )
}
