import { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'

export default function Header({ view, onBack, searchOpen, setSearchOpen, query, onQuery }) {
  const inputRef = useRef(null)
  const location = useLocation()
  const onPlayoff = location.pathname.startsWith('/playoff')

  // Detect mac vs other for the keyboard hint.
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => inputRef.current?.focus(), 60)
    }
  }, [searchOpen])

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setSearchOpen(true)
        inputRef.current?.focus()
      } else if (e.key === "Escape" && searchOpen) {
        setSearchOpen(false)
        onQuery("")
        inputRef.current?.blur()
      } else if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault()
        setSearchOpen(true)
        inputRef.current?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [searchOpen, setSearchOpen, onQuery])

  const hasQuery = query && query.length > 0
  const searchActive = searchOpen || hasQuery

  return (
    <header className="header">
      <div className="shell">
        <div className="header-inner">
          <div className="header-left">
            {view === "detail" ? (
              <button className="brand-back" onClick={onBack} aria-label="Back" type="button">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 18-6-6 6-6"/>
                </svg>
              </button>
            ) : null}
            <Link to="/" className="brand" aria-label="World Cup 2026 — home">
              <span className="brand-mark" aria-hidden="true">W</span>
              <span className="brand-text">World Cup</span>
              <span className="brand-year">2026</span>
            </Link>
          </div>

          <div className={"search-center" + (searchActive ? " is-active" : "")}>
            <label className="search-pill">
              <span className="search-icon" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="m21 21-4.3-4.3"/>
                </svg>
              </span>
              <input
                ref={inputRef}
                className="search-input"
                type="search"
                placeholder="Search teams, groups, venues…"
                value={query}
                onChange={(e) => onQuery(e.target.value)}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => { if (!query) setSearchOpen(false) }}
                autoComplete="off"
                spellCheck="false"
                aria-label="Search"
              />
              {hasQuery ? (
                <button
                  type="button"
                  className="search-clear"
                  onClick={() => { onQuery(""); inputRef.current?.focus() }}
                  aria-label="Clear search"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                  </svg>
                </button>
              ) : (
                <span className="search-kbd" aria-hidden="true">
                  <kbd>{isMac ? '⌘' : 'Ctrl'}</kbd><kbd>K</kbd>
                </span>
              )}
            </label>
          </div>

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
            <button
              type="button"
              className="search-mobile-btn"
              aria-label="Open search"
              onClick={() => { setSearchOpen(true); inputRef.current?.focus() }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.3-4.3"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
