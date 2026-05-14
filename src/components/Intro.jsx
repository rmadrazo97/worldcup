export default function Intro({ matches, todayIso, eyebrow }) {
  const liveCount = matches.filter(m => m.status === "LIVE").length
  const todayCount = matches.filter(m => m.date === todayIso).length
  return (
    <div className="intro">
      <span className="intro-eyebrow">{eyebrow}</span>
      <h1 className="intro-title">Live scores &amp; fixtures.</h1>
      <div className="intro-meta">
        <span className="now-dot" />
        <span>{liveCount} live now · {todayCount} matches today</span>
      </div>
    </div>
  )
}
