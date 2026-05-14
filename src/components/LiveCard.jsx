import { Link } from 'react-router-dom'
import { TEAMS, VENUES } from '../api/mock-data.js'
import { Flag } from './Flag.jsx'

export default function LiveCard({ match }) {
  return (
    <Link to={`/match/${match.id}`} className="live-card">
      <div className="live-card-top">
        <span className="live-card-group">Group {match.group} · MD{match.md}</span>
        <span className="live-card-venue">{VENUES[match.venue]}</span>
      </div>
      <div className="live-card-body">
        <div className="live-team">
          <span className="crest"><Flag team={match.home} size="lg" /></span>
          <span className="name">{TEAMS[match.home].name}</span>
        </div>
        <div className="live-score">
          <span>{match.hs}</span>
          <span className="sep">–</span>
          <span>{match.as}</span>
        </div>
        <div className="live-team">
          <span className="crest"><Flag team={match.away} size="lg" /></span>
          <span className="name">{TEAMS[match.away].name}</span>
        </div>
      </div>
      <div className="live-card-foot">
        <span className="live-status">
          <span className="live-dot" />
          <span>Live</span>
        </span>
        <span className="live-minute">{match.minute}</span>
      </div>
    </Link>
  )
}

export function LiveSection({ matches }) {
  const live = matches.filter(m => m.status === "LIVE")
  if (live.length === 0) return null
  return (
    <section className="section">
      <div className="section-head">
        <h2 className="section-title">
          Live now
          <span className="badge-count">{live.length}</span>
        </h2>
        <a href="#" className="section-aux" onClick={(e)=>e.preventDefault()}>All matches →</a>
      </div>
      <div className="live-grid">
        {live.map(m => <LiveCard key={m.id} match={m} />)}
      </div>
    </section>
  )
}
