import { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'

export default function Header({ view, onBack, searchOpen, setSearchOpen, query, onQuery }) {
  const inputRef = useRef(null)
  const location = useLocation()
  const onPlayoff = location.pathname.startsWith('/playoff')

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
            <button className="brand-back" onClick={onBack} aria-label="Back" type="button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6"/>
              </svg>
            </button>
          ) : null}
          <Link to="/" className="brand" aria-label="World Cup 2026 — home">
            <span className="brand-mark" aria-hidden="true">W</span>
            <span>World Cup</span>
            <span className="brand-year">2026</span>
          </Link>
          <div className="header-right">
            {!onPlayoff && (
              <Link to="/playoff" className="header-playoff-link" aria-label="Playoffs bracket">
                <span className="hpl-mark" aria-hidden="true">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 4h12v6a6 6 0 0 1-12 0V4z"/>
                    <path d="M6 6H3v3a4 4 0 0 0 4 4"/>
                    <path d="M18 6h3v3a4 4 0 0 1-4 4"/>
                    <path d="M10 20h4"/>
                    <path d="M12 16v4"/>
                  </svg>
                </span>
                <span className="hpl-text">Playoffs</span>
              </Link>
            )}
            <div className={"search-wrap" + (searchOpen ? " is-open" : "")}>
              <input
                ref={inputRef}
                className="search-input"
                type="search"
                placeholder="Search teams, groups, venues…"
                value={query}
                onChange={(e) => onQuery(e.target.value)}
                onBlur={() => {
                  if (!query) setSearchOpen(false)
                }}
                autoComplete="off"
                spellCheck="false"
                aria-label="Search"
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
                aria-label={searchOpen ? (query ? "Clear search" : "Close search") : "Open search (press / or ⌘K)"}
                type="button"
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
