import { Flag } from './Flag.jsx'
import { useTeams } from '../api/providers.jsx'

const PERIOD_LABELS = {
  half: 'Half time',
  full: 'Full time',
  et_start: 'Extra time',
  et_half: 'Extra time · half',
  et_full: 'Extra time · end',
  pen_start: 'Penalty shootout',
}

export default function TimelineView({ match, details }) {
  const { teams } = useTeams()
  const events = details?.events
  if (!events || events.length === 0) {
    return (
      <div className="detail-fallback">
        <h4>No events yet</h4>
        <p>Goals, cards and substitutions will be tracked here in real time.</p>
      </div>
    )
  }
  // Drop VAR rows — they are decorative-only and don't fit the simple feed.
  const filtered = events.filter(ev => ev.type !== 'var')
  return (
    <div className="timeline-wrap">
      {filtered.map((ev, i) => (
        <TimelineEvent key={i} ev={ev} teams={teams} />
      ))}
    </div>
  )
}

function TimelineEvent({ ev, teams }) {
  // Period markers — no team attached
  if (PERIOD_LABELS[ev.type]) {
    const cls = (ev.type === 'half' || ev.type === 'et_half') ? 'half' : 'full'
    return (
      <div className={'timeline-event is-' + cls}>
        <span className="min">{ev.min}</span>
        <div className="ev">
          <div className="ev-text">{PERIOD_LABELS[ev.type]}</div>
        </div>
      </div>
    )
  }

  const team = ev.team ? teams[ev.team] : null
  let icon = null
  let sub = ''
  let isGoal = false

  if (ev.type === 'goal' || ev.type === 'own_goal' || ev.type === 'penalty_goal') {
    isGoal = true
    icon = (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M5.6 18.4 18.4 5.6" strokeWidth="1.4" opacity="0.5"/>
      </svg>
    )
    if (ev.type === 'own_goal') sub = 'Own goal'
    else if (ev.type === 'penalty_goal') sub = 'Penalty'
    else sub = ev.assist ? `Goal · assist ${ev.assist}` : 'Goal'
  } else if (ev.type === 'yellow') {
    icon = <span style={{display:'inline-block', width:10, height:13, background:'#FFC107', borderRadius:1.5}} />
    sub = 'Yellow card'
  } else if (ev.type === 'second_yellow') {
    icon = <span style={{display:'inline-block', width:10, height:13, background:'#E80F13', borderRadius:1.5}} />
    sub = 'Second yellow'
  } else if (ev.type === 'red') {
    icon = <span style={{display:'inline-block', width:10, height:13, background:'#E80F13', borderRadius:1.5}} />
    sub = 'Red card'
  } else if (ev.type === 'sub') {
    icon = (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 3h5v5M21 3l-7 7M8 21H3v-5M3 21l7-7"/>
      </svg>
    )
    sub = `${ev.playerOff || ''} → ${ev.playerOn || ''}`
  } else if (ev.type === 'shootout_kick') {
    icon = (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
      </svg>
    )
    sub = ev.scored ? 'Penalty scored' : 'Penalty missed'
  } else {
    // Unknown event type — render minimally rather than crashing.
    sub = ev.type
  }

  return (
    <div className={'timeline-event' + (isGoal ? ' is-goal' : '')}>
      <span className="min">{ev.min}</span>
      <div className="ev">
        <span className="ev-icon">{icon}</span>
        <div className="ev-text">
          <span className="ev-player">{ev.player || (ev.type === 'sub' ? 'Substitution' : '')}</span>
          <span className="ev-sub">{sub}</span>
        </div>
        <div className="ev-tag">
          {isGoal && ev.score && <span className="ev-score">{ev.score}</span>}
          {ev.team && (
            <>
              <span className="ev-flag"><Flag team={ev.team} /></span>
              <span>{team?.short || ev.team}</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
