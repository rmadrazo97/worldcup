import { Link } from 'react-router-dom'
import { TEAMS } from '../api/mock-data.js'
import { CountryCrest } from './Flag.jsx'

export default function GroupCard({ group, standings, groupMatches }) {
  const hasLive = groupMatches.some(m => m.status === "LIVE")
  const played = groupMatches.filter(m => m.status === "FT").length
  const liveCount = groupMatches.filter(m => m.status === "LIVE").length

  let stateLabel = `${played}/6 played`
  if (hasLive) stateLabel = `${liveCount} live · ${played}/6 played`
  else if (played === 0) stateLabel = "Not started"
  else if (played === 6) stateLabel = "Complete"

  return (
    <Link
      className={"group-card" + (hasLive ? " has-live" : "")}
      to={`/group/${group.id}`}
    >
      <div className="group-head">
        <div className="group-id-block">
          <span className="group-id">{group.id}</span>
          <span className="group-id-label">Group</span>
        </div>
        <span className={"group-state" + (hasLive ? " has-live" : "")}>{stateLabel}</span>
      </div>
      <div className="group-teams">
        {standings.map((row, i) => (
          <div key={row.team} className={"group-team-row" + (i < 2 ? " qual" : "")}>
            <span className="pos">{i + 1}</span>
            <div className="team-l">
              <CountryCrest team={row.team} variant="sm" />
              <span className="t-name">{TEAMS[row.team].name}</span>
            </div>
            <div className="t-stats">
              <span className="gd">{row.gd > 0 ? `+${row.gd}` : row.gd}</span>
              <span className="pts">{row.pts}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="group-foot">
        <span>4 teams · 6 matches</span>
        <span className="arrow">
          View group
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </span>
      </div>
    </Link>
  )
}
