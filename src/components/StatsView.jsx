import { MATCH_DETAILS, TEAMS } from '../api/mock-data.js'
import { CountryCrest } from './Flag.jsx'

export default function StatsView({ match }) {
  const details = MATCH_DETAILS[match.id]
  if (!details || !details.stats) {
    return (
      <div className="detail-fallback">
        <h4>Statistics not available yet</h4>
        <p>Live stats will appear here once the match kicks off.</p>
      </div>
    )
  }
  const stats = details.stats
  return (
    <div className="stats-wrap">
      <div className="stats-head">
        <div className="h-team">
          <CountryCrest team={match.home} variant="sm" />
          <span className="name">{TEAMS[match.home].short}</span>
        </div>
        <div className="h-mid">Match stats</div>
        <div className="h-team away">
          <CountryCrest team={match.away} variant="sm" />
          <span className="name">{TEAMS[match.away].short}</span>
        </div>
      </div>
      {Object.entries(stats).map(([label, [h, a]]) => {
        const total = (h + a) || 1
        const hPct = (h / total) * 100
        const aPct = (a / total) * 100
        return (
          <div className="stat-row" key={label}>
            <span className="v-home">{h}</span>
            <div className="bar home">
              <span className="fill" style={{ width: hPct + "%" }} />
            </div>
            <span className="stat-label">{label}</span>
            <div className="bar away">
              <span className="fill" style={{ width: aPct + "%" }} />
            </div>
            <span className="v-away">{a}</span>
          </div>
        )
      })}
    </div>
  )
}
