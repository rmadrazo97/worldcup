export default function Tabs({ active, onChange, counts }) {
  const items = [
    { id: "all",       label: "All"       },
    { id: "live",      label: "Live"      },
    { id: "today",     label: "Today"     },
    { id: "yesterday", label: "Yesterday" },
    { id: "upcoming",  label: "Upcoming"  },
  ]
  return (
    <div className="tabs" role="tablist" aria-label="Filter matches">
      {items.map(t => {
        const hasLive = t.id === "live" && counts.live > 0
        const isActive = active === t.id
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={isActive}
            type="button"
            className={
              "tab" +
              (isActive ? " active" : "") +
              (hasLive && !isActive ? " has-live" : "")
            }
            onClick={() => onChange(t.id)}
          >
            <span>{t.label}</span>
            <span className="tab-count" aria-label={`${counts[t.id]} matches`}>{counts[t.id]}</span>
          </button>
        )
      })}
    </div>
  )
}
