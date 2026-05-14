import { CountryCrest } from './Flag.jsx'
import { useTeam } from '../api/providers.jsx'

export default function StatsView({ match, details }) {
  const stats = details?.stats
  const homeTeam = useTeam(match.home)
  const awayTeam = useTeam(match.away)
  if (!stats) {
    return (
      <div className="detail-fallback">
        <h4>Statistics not available yet</h4>
        <p>Live stats will appear here once the match kicks off.</p>
      </div>
    )
  }
  const labels = stats.labels || Object.keys(stats.values || {})
  const values = stats.values || {}

  const renderRow = (label, h, a, displayH, displayA) => {
    const numericH = Number(h) || 0
    const numericA = Number(a) || 0
    const total = (numericH + numericA) || 1
    const hPct = (numericH / total) * 100
    const aPct = (numericA / total) * 100
    return (
      <div className="stat-row" key={label}>
        <span className="v-home">{displayH ?? h}</span>
        <div className="bar home">
          <span className="fill" style={{ width: hPct + '%' }} />
        </div>
        <span className="stat-label">{label}</span>
        <div className="bar away">
          <span className="fill" style={{ width: aPct + '%' }} />
        </div>
        <span className="v-away">{displayA ?? a}</span>
      </div>
    )
  }

  return (
    <div className="stats-wrap">
      <div className="stats-head">
        <div className="h-team">
          <CountryCrest team={match.home} variant="sm" />
          <span className="name">{homeTeam.short}</span>
        </div>
        <div className="h-mid">Match stats</div>
        <div className="h-team away">
          <CountryCrest team={match.away} variant="sm" />
          <span className="name">{awayTeam.short}</span>
        </div>
      </div>
      {labels.map(label => {
        const pair = values[label]
        if (!pair) return null
        const [h, a] = pair
        return renderRow(label, h, a)
      })}
      {Array.isArray(stats.xG) && stats.xG.length === 2 && (() => {
        const [h, a] = stats.xG
        const hDisp = (Number(h) || 0).toFixed(1)
        const aDisp = (Number(a) || 0).toFixed(1)
        return renderRow('xG', h, a, hDisp, aDisp)
      })()}
    </div>
  )
}
