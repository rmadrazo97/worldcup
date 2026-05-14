import { Link } from 'react-router-dom'
import { CountryCrest, TeamName } from './Flag.jsx'
import { formatShortDate } from '../api/clock.js'

function kickoffTime(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  } catch {
    return ''
  }
}

function shortDate(iso) {
  if (!iso) return ''
  try {
    return formatShortDate(new Date(iso))
  } catch {
    return ''
  }
}

export default function MatchCard({ match, to, showDate = false }) {
  const isLive  = match.status === 'LIVE'
  const isHT    = match.status === 'HT'
  const isFT    = match.status === 'FT'
  const isSched = match.status === 'SCHED'
  const isPP    = match.status === 'PP'
  const isCXL   = match.status === 'CXL'

  const homeWon = isFT && match.hs > match.as
  const awayWon = isFT && match.as > match.hs

  const kickoff = kickoffTime(match.kickoff_iso)
  const dateLabel = shortDate(match.kickoff_iso)

  const liveLabel = match.minute || (isHT ? 'HT' : 'Live')

  const topLabel = isSched || isPP || isCXL
    ? (isPP ? 'Postponed' : isCXL ? 'Cancelled' : kickoff)
    : (isLive || isHT ? liveLabel : 'FT')

  const className = 'match-card' + (isLive || isHT ? ' is-live' : '')
  const inner = (
    <>
      <div className="col-kickoff">
        <span className="kickoff-time">{topLabel}</span>
        <span className="kickoff-date">{showDate ? dateLabel : `Group ${match.group}`}</span>
      </div>
      <div className={'match-team home' + (awayWon ? ' dim' : '')}>
        <CountryCrest team={match.home} />
        <TeamName team={match.home} dim={awayWon} />
      </div>
      <div className={'score-cell' + (isLive || isHT ? ' live' : (isSched || isPP || isCXL) ? ' vs' : '')}>
        {(isSched || isPP || isCXL) ? (
          <>
            <span className="nums">vs</span>
            <span className="sub">{isPP ? 'Postponed' : isCXL ? 'Cancelled' : dateLabel}</span>
          </>
        ) : (
          <>
            <span className="nums">
              <span>{match.hs}</span>
              <span className="sep">–</span>
              <span>{match.as}</span>
            </span>
            <span className="sub">{isLive || isHT ? liveLabel : 'Full time'}</span>
          </>
        )}
      </div>
      <div className={'match-team away' + (homeWon ? ' dim' : '')}>
        <CountryCrest team={match.away} />
        <TeamName team={match.away} dim={homeWon} />
      </div>
      <div className="col-status">
        <span className="tag">
          {(isLive || isHT) && <><i style={{width:6,height:6,borderRadius:6,background:'var(--live)',boxShadow:'0 0 6px var(--live-glow)'}} /> Group {match.group}</>}
          {isFT && <>Group {match.group}</>}
          {(isSched || isPP || isCXL) && <>Group {match.group}</>}
        </span>
      </div>
    </>
  )

  if (to) {
    return <Link to={to} className={className}>{inner}</Link>
  }
  return <div className={className}>{inner}</div>
}
