import { Link } from 'react-router-dom'
import { CountryCrest, TeamName } from './Flag.jsx'
import { formatShortDate } from '../api/clock.js'
import { track } from '../api/analytics.js'
import { useTeam } from '../api/providers.jsx'

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
  const isDraw  = isFT && match.hs === match.as

  const kickoff = kickoffTime(match.kickoff_iso)
  const dateLabel = shortDate(match.kickoff_iso)

  const liveLabel = match.minute || (isHT ? 'HT' : 'Live')

  const topLabel = isSched || isPP || isCXL
    ? (isPP ? 'Postponed' : isCXL ? 'Cancelled' : kickoff)
    : (isLive || isHT ? liveLabel : 'FT')

  const homeTeam = useTeam(match.home)
  const awayTeam = useTeam(match.away)

  const ariaLabel = (isLive || isHT)
    ? `${homeTeam?.name || match.home} ${match.hs} ${awayTeam?.name || match.away} ${match.as}, ${isHT ? 'half time' : `live, minute ${match.minute || ''}`}`
    : isFT
      ? `${homeTeam?.name || match.home} ${match.hs} ${awayTeam?.name || match.away} ${match.as}, full time${homeWon ? `, ${homeTeam?.name} win` : awayWon ? `, ${awayTeam?.name} win` : ', draw'}`
      : `${homeTeam?.name || match.home} vs ${awayTeam?.name || match.away}, ${isPP ? 'postponed' : isCXL ? 'cancelled' : `kickoff ${kickoff}`}`

  const className = 'match-card'
    + (isLive || isHT ? ' is-live' : '')
    + (isFT ? ' is-ft' : '')
    + (isSched ? ' is-sched' : '')

  const handleClick = () => {
    track('select_match', { match_id: match.id, status: match.status, group: match.group })
  }

  const inner = (
    <>
      <div className="col-kickoff">
        <span className="kickoff-time">{topLabel}</span>
        <span className="kickoff-date">{showDate ? dateLabel : `Group ${match.group}`}</span>
      </div>
      <div className={'match-team home' + (awayWon ? ' dim' : '') + (homeWon ? ' winner' : '')}>
        <CountryCrest team={match.home} />
        <TeamName team={match.home} dim={awayWon} />
        {homeWon && <WinnerMark />}
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
              <span className={homeWon ? 'w' : awayWon ? 'l' : ''}>{match.hs}</span>
              <span className="sep">–</span>
              <span className={awayWon ? 'w' : homeWon ? 'l' : ''}>{match.as}</span>
            </span>
            <span className="sub">{isLive || isHT ? liveLabel : isDraw ? 'Full time · Draw' : 'Full time'}</span>
          </>
        )}
      </div>
      <div className={'match-team away' + (homeWon ? ' dim' : '') + (awayWon ? ' winner' : '')}>
        <CountryCrest team={match.away} />
        <TeamName team={match.away} dim={homeWon} />
        {awayWon && <WinnerMark />}
      </div>
      <div className="col-status">
        <span className="tag">
          {(isLive || isHT) && <><i className="tag-live-dot" aria-hidden="true" /> Group {match.group}</>}
          {isFT && <>Group {match.group}</>}
          {(isSched || isPP || isCXL) && <>Group {match.group}</>}
        </span>
      </div>
    </>
  )

  if (to) {
    return (
      <Link to={to} className={className} aria-label={ariaLabel} onClick={handleClick}>
        {inner}
      </Link>
    )
  }
  return <div className={className} aria-label={ariaLabel}>{inner}</div>
}

function WinnerMark() {
  return (
    <span className="winner-mark" aria-label="Winner" title="Winner">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    </span>
  )
}
