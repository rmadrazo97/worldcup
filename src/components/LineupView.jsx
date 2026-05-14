import { CountryCrest } from './Flag.jsx'
import Pitch from './Pitch.jsx'
import { useTeam } from '../api/providers.jsx'

function displayName(p) {
  return p.short_name || p.name || ''
}

function pitchLineup(lineup) {
  const formation = lineup.formation || '4-3-3'
  const starters = (lineup.starters || []).map(p => ({
    n: p.n != null ? p.n : '–',
    name: displayName(p),
  }))
  return { formation, starters }
}

export default function LineupView({ match, details }) {
  const home = details?.lineups?.home || null
  const away = details?.lineups?.away || null
  const homeTeam = useTeam(match.home)
  const awayTeam = useTeam(match.away)

  if (!home || !away) {
    return (
      <div className="detail-fallback">
        <h4>Line-ups not announced</h4>
        <p>The official squads will be confirmed an hour before kickoff.</p>
      </div>
    )
  }

  const homePitch = pitchLineup(home)
  const awayPitch = pitchLineup(away)
  const homeSubsText = (home.subs || []).map(displayName).filter(Boolean).join(' · ')
  const awaySubsText = (away.subs || []).map(displayName).filter(Boolean).join(' · ')

  return (
    <div className="lineup-wrap">
      <div className="lineup-meta">
        <div className="side">
          <CountryCrest team={match.home} variant="sm" />
          <span>{homeTeam.name}</span>
          <span className="formation">{homePitch.formation}</span>
        </div>
        <div className="side" style={{flexDirection:'row-reverse'}}>
          <CountryCrest team={match.away} variant="sm" />
          <span>{awayTeam.name}</span>
          <span className="formation">{awayPitch.formation}</span>
        </div>
      </div>
      <div className="pitch-wrap">
        <Pitch
          home={{ formation: homePitch.formation, lineup: homePitch }}
          away={{ formation: awayPitch.formation, lineup: awayPitch }}
        />
      </div>
      <div className="lineup-subs">
        <div className="lineup-subs-col">
          <span className="label">Bench — {homeTeam.short}</span>
          <span className="names">{homeSubsText}</span>
          <span className="coach">Coach · {home.coach || '—'}</span>
        </div>
        <div className="lineup-subs-col">
          <span className="label">Bench — {awayTeam.short}</span>
          <span className="names">{awaySubsText}</span>
          <span className="coach">Coach · {away.coach || '—'}</span>
        </div>
      </div>
    </div>
  )
}
