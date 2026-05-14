import { useEffect, useRef } from 'react'

export default function Header({ view, onBack, searchOpen, setSearchOpen, query, onQuery }) {
  const inputRef = useRef(null)

  useEffect(() => {
    if (searchOpen) {
      // Tiny defer so the width transition starts visibly before focus
      setTimeout(() => inputRef.current?.focus(), 60)
    }
  }, [searchOpen])

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setSearchOpen(true)
      } else if (e.key === "Escape" && searchOpen) {
        setSearchOpen(false)
        onQuery("")
      } else if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [searchOpen, setSearchOpen, onQuery])

  return (
    <header className="header">
      <div className="shell">
        <div className="header-inner">
          {view === "detail" ? (
            <button className="brand-back" onClick={onBack} aria-label="Back">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6"/>
              </svg>
            </button>
          ) : null}
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">W</span>
            <span>World Cup</span>
            <span className="brand-year">2026</span>
          </div>
          <div className="header-right">
            <div className={"search-wrap" + (searchOpen ? " is-open" : "")}>
              <input
                ref={inputRef}
                className="search-input"
                type="text"
                placeholder="Search teams, groups, venues…"
                value={query}
                onChange={(e) => onQuery(e.target.value)}
                onBlur={() => {
                  if (!query) setSearchOpen(false)
                }}
                autoComplete="off"
                spellCheck="false"
              />
              <span className="kbd" aria-hidden="true">ESC</span>
              <button
                className={"search-btn" + (searchOpen ? " is-open" : "")}
                onClick={() => {
                  if (searchOpen && query) {
                    onQuery("")
                  } else {
                    setSearchOpen(!searchOpen)
                  }
                }}
                aria-label={searchOpen ? "Close search" : "Open search"}
              >
                {searchOpen && query ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.3-4.3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
