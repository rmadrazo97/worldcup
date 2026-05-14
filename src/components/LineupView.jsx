import { LINEUPS, TEAMS } from '../api/mock-data.js'
import { CountryCrest } from './Flag.jsx'
import Pitch from './Pitch.jsx'

export default function LineupView({ match }) {
  const home = { code: match.home, lineup: LINEUPS[match.home] }
  const away = { code: match.away, lineup: LINEUPS[match.away] }
  if (!home.lineup || !away.lineup) {
    return (
      <div className="detail-fallback">
        <h4>Line-ups not announced</h4>
        <p>The official squads will be confirmed an hour before kickoff.</p>
      </div>
    )
  }
  return (
    <div className="lineup-wrap">
      <div className="lineup-meta">
        <div className="side">
          <CountryCrest team={match.home} variant="sm" />
          <span>{TEAMS[match.home].name}</span>
          <span className="formation">{home.lineup.formation}</span>
        </div>
        <div className="side" style={{flexDirection:"row-reverse"}}>
          <CountryCrest team={match.away} variant="sm" />
          <span>{TEAMS[match.away].name}</span>
          <span className="formation">{away.lineup.formation}</span>
        </div>
      </div>
      <div className="pitch-wrap">
        <Pitch
          home={{ formation: home.lineup.formation, lineup: home.lineup }}
          away={{ formation: away.lineup.formation, lineup: away.lineup }}
        />
      </div>
      <div className="lineup-subs">
        <div className="lineup-subs-col">
          <span className="label">Bench — {TEAMS[match.home].short}</span>
          <span className="names">{home.lineup.subs.join(" · ")}</span>
          <span className="coach">Coach · {home.lineup.coach}</span>
        </div>
        <div className="lineup-subs-col">
          <span className="label">Bench — {TEAMS[match.away].short}</span>
          <span className="names">{away.lineup.subs.join(" · ")}</span>
          <span className="coach">Coach · {away.lineup.coach}</span>
        </div>
      </div>
    </div>
  )
}
