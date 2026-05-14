import { Link } from 'react-router-dom'
import { CountryCrest } from './Flag.jsx'
import { formatShortDate } from '../api/clock.js'
import { track } from '../api/analytics.js'
import { useTeam } from '../api/providers.jsx'

const STAGE_LABEL = {
  group: null,                // handled separately so we can append " · MD"
  r32: 'Round of 32',
  r16: 'Round of 16',
  qf:  'Quarter-final',
  sf:  'Semi-final',
  final: 'Final',
  third_place: 'Third place',
}

function contextLabel(match) {
  if (match.stage && match.stage !== 'group') {
    return STAGE_LABEL[match.stage] || match.stage_label || 'Knockout'
  }
  if (match.group) {
    return match.md ? `Group ${match.group} · MD ${match.md}` : `Group ${match.group}`
  }
  return match.stage_label || ''
}

function kickoffTime(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  } catch { return '' }
}
function shortDate(iso) {
  if (!iso) return ''
  try { return formatShortDate(new Date(iso)) } catch { return '' }
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
  const context = contextLabel(match)

  const homeTeam = useTeam(match.home)
  const awayTeam = useTeam(match.away)

  const liveLabel = match.minute || (isHT ? 'HT' : 'LIVE')
  const statusBadge =
    isLive || isHT ? (isHT ? 'HT' : liveLabel)
    : isFT         ? 'FT'
    : isPP         ? 'PP'
    : isCXL        ? 'CXL'
    : kickoff

  const subline =
    isLive || isHT ? (isHT ? 'Half time' : 'Live now')
    : isFT  ? (isDraw ? 'Full time · Draw' : 'Full time')
    : isPP  ? 'Postponed'
    : isCXL ? 'Cancelled'
    : showDate || !context ? dateLabel : null

  const ariaLabel = (isLive || isHT)
    ? `${homeTeam?.name || match.home} ${match.hs} ${awayTeam?.name || match.away} ${match.as}, ${isHT ? 'half time' : `live, minute ${match.minute || ''}`}`
    : isFT
      ? `${homeTeam?.name || match.home} ${match.hs} ${awayTeam?.name || match.away} ${match.as}, full time${homeWon ? `, ${homeTeam?.name} win` : awayWon ? `, ${awayTeam?.name} win` : ', draw'}`
      : `${homeTeam?.name || match.home} vs ${awayTeam?.name || match.away}, ${isPP ? 'postponed' : isCXL ? 'cancelled' : `kickoff ${kickoff}`}`

  const className = 'match-card'
    + (isLive || isHT ? ' is-live' : '')
    + (isFT ? ' is-ft' : '')
    + (isSched ? ' is-sched' : '')
    + ((isPP || isCXL) ? ' is-off' : '')

  const handleClick = () => {
    track('select_match', { match_id: match.id, status: match.status, group: match.group })
  }

  const inner = (
    <>
      <header className="mc-eyebrow">
        {context && <span className="mc-context">{context}</span>}
        <span className={
          'mc-status'
          + (isLive || isHT ? ' is-live' : '')
          + (isFT ? ' is-ft' : '')
          + (isSched ? ' is-sched' : '')
          + ((isPP || isCXL) ? ' is-off' : '')
        }>
          {(isLive || isHT) && <span className="mc-status-dot" aria-hidden="true" />}
          {statusBadge}
        </span>
      </header>

      <div className="mc-body">
        <div className={'mc-team is-home' + (homeWon ? ' is-winner' : awayWon ? ' is-loser' : '')}>
          <span className="mc-crest"><CountryCrest team={match.home} /></span>
          <span className="mc-name">{homeTeam?.name || match.home}</span>
          <span className="mc-short">{homeTeam?.short || match.home}</span>
        </div>

        <div className={'mc-score' + (isLive || isHT ? ' is-live' : '') + (!isLive && !isHT && !isFT ? ' is-vs' : '')}>
          {(isSched || isPP || isCXL) ? (
            <>
              <div className="mc-vs-time">{isPP ? 'PP' : isCXL ? 'CXL' : kickoff}</div>
              <div className="mc-vs-label">VS</div>
              <div className="mc-vs-date">{dateLabel}</div>
            </>
          ) : (
            <>
              <div className="mc-score-nums">
                <span className={'mc-num' + (homeWon ? ' is-win' : awayWon ? ' is-loss' : '')}>{match.hs}</span>
                <span className="mc-num-sep" aria-hidden="true">–</span>
                <span className={'mc-num' + (awayWon ? ' is-win' : homeWon ? ' is-loss' : '')}>{match.as}</span>
              </div>
              {match.pens && (
                <div className="mc-pens">({match.pens.hs} – {match.pens.as} pens)</div>
              )}
              {subline && <div className="mc-score-sub">{subline}</div>}
            </>
          )}
        </div>

        <div className={'mc-team is-away' + (awayWon ? ' is-winner' : homeWon ? ' is-loser' : '')}>
          <span className="mc-crest"><CountryCrest team={match.away} /></span>
          <span className="mc-name">{awayTeam?.name || match.away}</span>
          <span className="mc-short">{awayTeam?.short || match.away}</span>
        </div>
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
