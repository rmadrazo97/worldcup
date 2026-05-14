import { useEffect, useRef, useState } from 'react'

// Tournament editions surfaced by the picker. Order matters — most recent
// first. Mirror this list against `src/api/season.js#VALID` if it ever
// grows.
const EDITIONS = [
  { year: 2026, host: 'Canada · Mexico · USA' },
  { year: 2022, host: 'Qatar' },
  { year: 2018, host: 'Russia' },
]
const VALID_YEARS = new Set(EDITIONS.map(e => e.year))

function readSeasonFromUrl() {
  if (typeof window === 'undefined') return 2026
  const raw = new URLSearchParams(window.location.search).get('season')
  const n = Number(raw)
  return VALID_YEARS.has(n) ? n : 2026
}

export default function SeasonPicker() {
  const [open, setOpen] = useState(false)
  const [active] = useState(readSeasonFromUrl)
  const rootRef = useRef(null)
  const triggerRef = useRef(null)

  // Close on outside-click / Escape / focusout — standard popover hygiene.
  useEffect(() => {
    if (!open) return
    const onPointer = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const select = (year) => {
    setOpen(false)
    if (year === active) return
    const url = new URL(window.location.href)
    if (year === 2026) url.searchParams.delete('season')
    else url.searchParams.set('season', String(year))
    // Full reload so providers re-derive their caches against the new
    // season; avoids any stale-data races between client state and the
    // function-level cache keys.
    window.location.assign(url.toString())
  }

  const activeHost = EDITIONS.find(e => e.year === active)?.host

  return (
    <div className={'season-picker' + (open ? ' is-open' : '')} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="season-trigger"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Tournament edition selector. Current: ${active} (${activeHost ?? ''})`}
      >
        <span className="season-trigger-year">{active}</span>
        <svg
          className="season-trigger-chevron"
          width="10" height="10" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <ul className="season-menu" role="listbox" aria-label="Choose tournament edition">
          {EDITIONS.map(({ year, host }) => {
            const isActive = year === active
            return (
              <li key={year}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  className={'season-option' + (isActive ? ' is-active' : '')}
                  onClick={() => select(year)}
                >
                  <span className="season-option-meta">
                    <span className="season-option-year">{year}</span>
                    <span className="season-option-host">{host}</span>
                  </span>
                  {isActive && (
                    <svg
                      className="season-option-check"
                      width="14" height="14" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor" strokeWidth="2.5"
                      strokeLinecap="round" strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
