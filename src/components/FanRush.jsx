export default function FanRush({ count }) {
  return (
    <span className="fan-pill">
      <span className="fan-stack">
        <span className="fan-dot">A</span>
        <span className="fan-dot f2">M</span>
        <span className="fan-dot f3">L</span>
      </span>
      <span>{(count / 1000).toFixed(1)}k+</span>
    </span>
  )
}
