import { FORMATIONS } from '../api/formations.js'

export default function Pitch({ home, away }) {
  const homeForm = FORMATIONS[home.formation] || FORMATIONS["4-3-3"]
  const awayForm = FORMATIONS[away.formation] || FORMATIONS["4-3-3"]

  const homePositions = homeForm.map(p => ({ x: p.x, y: 140 - (p.y * 70 / 100) }))
  const awayPositions = awayForm.map(p => ({ x: p.x, y:        p.y * 70 / 100  }))

  return (
    <svg className="pitch-svg" viewBox="0 0 100 140" preserveAspectRatio="xMidYMid meet">
      <rect x="2" y="2" width="96" height="136" rx="2" className="pitch-line" />
      <line x1="2" y1="70" x2="98" y2="70" className="pitch-line center" />
      <circle cx="50" cy="70" r="10" className="pitch-line" />
      <circle cx="50" cy="70" r="0.5" fill="rgba(255,255,255,0.30)" />
      <rect x="22" y="120" width="56" height="18" className="pitch-line" />
      <rect x="36" y="130" width="28" height="8"  className="pitch-line" />
      <rect x="44" y="138" width="12" height="3"  className="pitch-line" />
      <rect x="22" y="2"  width="56" height="18" className="pitch-line" />
      <rect x="36" y="2"  width="28" height="8"  className="pitch-line" />
      <rect x="44" y="-1" width="12" height="3"  className="pitch-line" />

      <circle cx="50" cy="126" r="0.5" fill="rgba(255,255,255,0.30)" />
      <circle cx="50" cy="14"  r="0.5" fill="rgba(255,255,255,0.30)" />

      {away.lineup.starters.map((p, i) => {
        const pos = awayPositions[i]
        if (!pos) return null
        return (
          <PlayerNode key={"a" + i} side="away" player={p} pos={pos} reverse />
        )
      })}

      {home.lineup.starters.map((p, i) => {
        const pos = homePositions[i]
        if (!pos) return null
        return (
          <PlayerNode key={"h" + i} side="home" player={p} pos={pos} />
        )
      })}
    </svg>
  )
}

function PlayerNode({ player, pos, side, reverse }) {
  const labelY = reverse ? pos.y - 5.5 : pos.y + 5.5
  const display = player.name.length > 14 ? player.name.slice(0, 13) + "…" : player.name
  const labelWidth = Math.max(14, display.length * 1.55)
  return (
    <g className={"player-node " + side}>
      <circle cx={pos.x} cy={pos.y} r="2.8" className="num-bg" />
      <text x={pos.x} y={pos.y} className="num">{player.n}</text>
      <rect
        x={pos.x - labelWidth / 2}
        y={labelY - 1.6}
        width={labelWidth}
        height="3.2"
        rx="1.2"
        className="label-bg"
      />
      <text x={pos.x} y={labelY} className="label">{display}</text>
    </g>
  )
}
