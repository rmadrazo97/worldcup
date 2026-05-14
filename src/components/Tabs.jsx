export default function Tabs({ active, onChange, counts }) {
  const items = [
    { id: "all",      label: "All"      },
    { id: "live",     label: "Live"     },
    { id: "today",    label: "Today"    },
    { id: "yesterday",label: "Yesterday"},
    { id: "upcoming", label: "Upcoming" },
  ]
  return (
    <div className="tabs">
      {items.map(t => {
        const hasLive = t.id === "live" && counts.live > 0
        return (
          <button
            key={t.id}
            className={
              "tab" +
              (active === t.id ? " active" : "") +
              (hasLive && active !== t.id ? " has-live" : "")
            }
            onClick={() => onChange(t.id)}
          >
            <span>{t.label}</span>
            <span className="tab-count">{counts[t.id]}</span>
          </button>
        )
      })}
    </div>
  )
}
