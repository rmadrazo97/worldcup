import { MATCH_DETAILS, TEAMS } from '../api/mock-data.js'
import { Flag } from './Flag.jsx'

export default function TimelineView({ match }) {
  const details = MATCH_DETAILS[match.id]
  if (!details || !details.timeline) {
    return (
      <div className="detail-fallback">
        <h4>No events yet</h4>
        <p>Goals, cards and substitutions will be tracked here in real time.</p>
      </div>
    )
  }
  return (
    <div className="timeline-wrap">
      {details.timeline.map((ev, i) => (
        <TimelineEvent key={i} ev={ev} />
      ))}
    </div>
  )
}

function TimelineEvent({ ev }) {
  if (ev.type === "half" || ev.type === "full") {
    return (
      <div className={"timeline-event is-" + ev.type}>
        <span className="min">{ev.min}</span>
        <div className="ev">
          <div className="ev-text">{ev.type === "half" ? "Half time" : "Full time"}</div>
        </div>
      </div>
    )
  }
  const team = TEAMS[ev.team]
  let icon, sub
  if (ev.type === "goal") {
    icon = (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M5.6 18.4 18.4 5.6" strokeWidth="1.4" opacity="0.5"/>
      </svg>
    )
    sub = ev.assist ? `Goal · assist ${ev.assist}` : "Goal"
  } else if (ev.type === "yellow") {
    icon = <span style={{display:"inline-block", width:10, height:13, background:"#FFC107", borderRadius:1.5}} />
    sub = "Yellow card"
  } else if (ev.type === "red") {
    icon = <span style={{display:"inline-block", width:10, height:13, background:"#E80F13", borderRadius:1.5}} />
    sub = "Red card"
  } else if (ev.type === "sub") {
    icon = (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 3h5v5M21 3l-7 7M8 21H3v-5M3 21l7-7"/>
      </svg>
    )
    sub = `${ev.playerOff} → ${ev.playerOn}`
  }
  const isGoal = ev.type === "goal"
  return (
    <div className={"timeline-event" + (isGoal ? " is-goal" : "")}>
      <span className="min">{ev.min}</span>
      <div className="ev">
        <span className="ev-icon">{icon}</span>
        <div className="ev-text">
          <span className="ev-player">{ev.player || (ev.type === "sub" ? "Substitution" : "")}</span>
          <span className="ev-sub">{sub}</span>
        </div>
        <div className="ev-tag">
          {isGoal && <span className="ev-score">{ev.score}</span>}
          <span className="ev-flag"><Flag team={ev.team} /></span>
          <span>{team.short}</span>
        </div>
      </div>
    </div>
  )
}
