import { Link } from 'react-router-dom'
import { CountryCrest, TeamName } from './Flag.jsx'

export default function MatchCard({ match, to, showDate = false }) {
  const isLive = match.status === "LIVE"
  const isFT   = match.status === "FT"
  const isSched= match.status === "SCHED"

  const homeWon = isFT && match.hs > match.as
  const awayWon = isFT && match.as > match.hs

  const className = "match-card" + (isLive ? " is-live" : "")
  const inner = (
    <>
      <div className="col-kickoff">
        <span className="kickoff-time">
          {isSched ? match.kickoff.replace(/:00 /, " ") : isLive ? match.minute : "FT"}
        </span>
        <span className="kickoff-date">{showDate ? match.date : `Group ${match.group}`}</span>
      </div>
      <div className={"match-team home" + (awayWon ? " dim" : "")}>
        <CountryCrest team={match.home} />
        <TeamName team={match.home} dim={awayWon} />
      </div>
      <div className={"score-cell" + (isLive ? " live" : isSched ? " vs" : "")}>
        {isSched ? (
          <>
            <span className="nums">vs</span>
            <span className="sub">{match.date}</span>
          </>
        ) : (
          <>
            <span className="nums">
              <span>{match.hs}</span>
              <span className="sep">–</span>
              <span>{match.as}</span>
            </span>
            <span className="sub">{isLive ? match.minute : "Full time"}</span>
          </>
        )}
      </div>
      <div className={"match-team away" + (homeWon ? " dim" : "")}>
        <CountryCrest team={match.away} />
        <TeamName team={match.away} dim={homeWon} />
      </div>
      <div className="col-status">
        <span className="tag">
          {isLive  && <><i style={{width:6,height:6,borderRadius:6,background:"var(--live)",boxShadow:"0 0 6px var(--live-glow)"}} /> Group {match.group}</>}
          {isFT    && <>Group {match.group}</>}
          {isSched && <>Group {match.group}</>}
        </span>
      </div>
    </>
  )

  if (to) {
    return <Link to={to} className={className}>{inner}</Link>
  }
  return <div className={className}>{inner}</div>
}
