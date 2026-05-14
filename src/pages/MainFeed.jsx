import { useEffect, useMemo, useRef, useState } from 'react'
import { getGroups, getMatches, getStandings, getVenues } from '../api/scores.js'
import { getNow, getTournamentToday, formatShortDate, formatLongEyebrow, TOURNAMENT_WINDOW } from '../api/clock.js'
import { useTeams } from '../api/providers.jsx'
import { track, useTrackSearch } from '../api/analytics.js'
import Header from '../components/Header.jsx'
import Intro from '../components/Intro.jsx'
import DateStrip from '../components/DateStrip.jsx'
import Tabs from '../components/Tabs.jsx'
import MatchCard from '../components/MatchCard.jsx'
import GroupCard from '../components/GroupCard.jsx'
import { LiveSection } from '../components/LiveCard.jsx'
import Spinner from '../components/Spinner.jsx'
import { MatchCardSkeleton, GroupCardSkeleton } from '../components/Skeleton.jsx'
import Footer from '../components/Footer.jsx'

const dateKey = (m) => {
  if (!m?.kickoff_iso) return ''
  try { return formatShortDate(new Date(m.kickoff_iso)) } catch { return '' }
}

export default function MainFeed() {
  const { teams } = useTeams()
  const [matches, setMatches] = useState([])
  const [groups, setGroups] = useState([])
  const [venues, setVenues] = useState({})
  const [standingsByGroup, setStandingsByGroup] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('all')
  const [selectedDate, setSelectedDate] = useState(null) // null = follow today
  const feedRef = useRef(null)

  useTrackSearch(query)

  // `now` is clamped to the tournament window for 2026 — visits before
  // Jun 11 land on Jun 11, visits after Jul 19 land on Jul 19. This is
  // what drives the "today" pill and the default-day feed; the wall
  // clock is still available below for framing copy.
  const now = getTournamentToday()
  const todayIso = formatShortDate(now)
  const longDate = formatLongEyebrow(now)
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayIso = formatShortDate(yesterday)
  const wallNow = getNow()
  const beforeKickoff = wallNow < TOURNAMENT_WINDOW.start
  const afterFinal    = wallNow > TOURNAMENT_WINDOW.end

  // Effective date the feed is showing — selected pill, or today.
  const activeDateIso = selectedDate || todayIso
  const isViewingToday = activeDateIso === todayIso

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    Promise.all([getMatches(), getGroups(), getVenues()])
      .then(([m, g, v]) => {
        if (!alive) return
        setMatches(m)
        setGroups(g)
        setVenues(v || {})
        setLoading(false)
        // Kick off per-group standings in parallel; partial failure is fine.
        Promise.all(
          g.map(group => getStandings(group.id)
            .then(s => [group.id, s])
            .catch(() => [group.id, []]))
        ).then(pairs => {
          if (!alive) return
          setStandingsByGroup(Object.fromEntries(pairs))
        })
      })
      .catch((e) => {
        if (!alive) return
        setError(e)
        setLoading(false)
      })
    return () => { alive = false }
  }, [reloadKey])

  const retry = () => setReloadKey((k) => k + 1)

  const activeMatchday = useMemo(() => {
    const m = matches.find((x) => dateKey(x) === activeDateIso)
    return m ? m.md : null
  }, [matches, activeDateIso])

  // When the wall clock is outside the tournament window AND the user is
  // viewing the clamped "today" pill, surface why so they don't think the
  // page is wrong.
  const eyebrow = (() => {
    if (isViewingToday && beforeKickoff) return `Tournament opens ${longDate}`
    if (isViewingToday && afterFinal)    return `Final · ${longDate}`
    return activeMatchday ? `${longDate} · Matchday ${activeMatchday}` : longDate
  })()

  const counts = useMemo(() => ({
    all:       matches.length,
    live:      matches.filter(m => m.status === 'LIVE' || m.status === 'HT').length,
    today:     matches.filter(m => dateKey(m) === todayIso).length,
    yesterday: matches.filter(m => dateKey(m) === yesterdayIso).length,
    upcoming:  matches.filter(m => m.status === 'SCHED').length,
  }), [matches, todayIso, yesterdayIso])

  const filtered = useMemo(
    () => applyQuery(matches, groups, query, teams, venues),
    [matches, groups, query, teams, venues],
  )
  const isSearching = query.trim().length > 0

  const sortByStatus = (list) => [...list].sort((a, b) => {
    const order = { LIVE: 0, HT: 0, SCHED: 1, FT: 2, PP: 3, CXL: 3 }
    return (order[a.status] ?? 9) - (order[b.status] ?? 9)
  })

  const feedByTab = useMemo(() => {
    let pool = filtered.matches
    if (tab === 'live')           pool = pool.filter(m => m.status === 'LIVE' || m.status === 'HT')
    else if (tab === 'today')     pool = pool.filter(m => dateKey(m) === todayIso)
    else if (tab === 'yesterday') pool = pool.filter(m => dateKey(m) === yesterdayIso)
    else if (tab === 'upcoming')  pool = pool.filter(m => m.status === 'SCHED')
    return sortByStatus(pool)
  }, [filtered.matches, tab, todayIso, yesterdayIso])

  const noResults = isSearching && filtered.matches.length === 0 && filtered.groups.length === 0

  // Pre-compute the date-pill feed (used when no tab/filter is active).
  const feedByDate = useMemo(
    () => sortByStatus(filtered.matches.filter(m => dateKey(m) === activeDateIso)),
    [filtered.matches, activeDateIso],
  )

  // Fallback when the selected day has no matches (pre-tournament, post-
  // final, or rest days): the next chronological scheduled matches so the
  // page is never an empty stub.
  const upcomingFallback = useMemo(() => {
    return matches
      .filter(m => m.status === 'SCHED')
      .sort((a, b) => (a.kickoff_iso || '').localeCompare(b.kickoff_iso || ''))
      .slice(0, 5)
  }, [matches])

  // Track filter changes (only after the initial render).
  const isInitialMount = useRef(true)
  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return }
    track('filter_change', { tab, selected_date: selectedDate || 'today' })
  }, [tab, selectedDate])

  const scrollToFeed = () => {
    feedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="app">
      <Header
        view="main"
        onBack={() => {}}
        searchOpen={searchOpen}
        setSearchOpen={setSearchOpen}
        query={query}
        onQuery={setQuery}
      />

      <div className="shell">
        <Intro
          matches={matches}
          todayIso={todayIso}
          activeDateIso={activeDateIso}
          eyebrow={eyebrow}
        />
        <DateStrip
          matches={matches}
          todayIso={todayIso}
          selectedIso={selectedDate}
          onSelect={(iso) => {
            setSelectedDate(iso)
            // Clear competing filters so the date is the lens.
            setTab('all')
            if (iso) {
              setTimeout(() => feedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
            }
          }}
        />

        {error && matches.length === 0 ? (
          <section className="section">
            <div className="empty">
              <div className="empty-title">Couldn't load matches</div>
              <div className="empty-sub">Check your connection and try again.</div>
              <div style={{marginTop:16}}>
                <button onClick={retry} className="btn-primary" type="button">Retry</button>
              </div>
            </div>
          </section>
        ) : loading && matches.length === 0 ? (
          <FeedLoadingState />
        ) : noResults ? (
          <section className="section">
            <div className="empty">
              <div className="empty-icon" aria-hidden="true">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
                </svg>
              </div>
              <div className="empty-title">No results for &ldquo;{query}&rdquo;</div>
              <div className="empty-sub">Try a team name (e.g. Brazil), code (BRA), group letter (C), or city.</div>
            </div>
          </section>
        ) : (
          <>
            {/* Live now — show only when on the today/no-filter view */}
            {!isSearching && tab === 'all' && isViewingToday && (
              <LiveSection matches={matches} venues={venues} onJumpToFeed={scrollToFeed} />
            )}

            {/* Feed (date-driven by default, tab-driven when a tab is selected). */}
            <section className="section" ref={feedRef}>
              <div className="section-head">
                <h2 className="section-title">
                  {isSearching && tab === 'all' && 'Matches'}
                  {!isSearching && tab === 'all' && (isViewingToday ? "Today's matches" : matchesHeading(activeDateIso))}
                  {tab === 'live' && 'Live matches'}
                  {tab === 'today' && "Today's matches"}
                  {tab === 'yesterday' && 'Yesterday'}
                  {tab === 'upcoming' && 'Upcoming'}
                  <span className="badge-count">{(tab === 'all' && !isSearching) ? feedByDate.length : feedByTab.length}</span>
                </h2>
                <div className="section-controls">
                  <Tabs active={tab} onChange={setTab} counts={counts} />
                </div>
              </div>

              {(() => {
                const isDefaultView = tab === 'all' && !isSearching
                const list = isDefaultView ? feedByDate : feedByTab
                if (list.length === 0) {
                  // Default view: surface the next fixtures so the page is
                  // never an empty stub before/after the tournament or on
                  // rest days. Other tabs keep their stricter empty state.
                  if (isDefaultView && upcomingFallback.length > 0) {
                    const banner = beforeKickoff
                      ? 'Tournament starts soon'
                      : afterFinal ? 'Tournament concluded' : 'Up next'
                    return (
                      <>
                        <div className="upcoming-banner">
                          <span className="upcoming-eyebrow">{banner}</span>
                          <span className="upcoming-sub">No matches on {activeDateIso}. Showing the next fixtures.</span>
                        </div>
                        <div className="match-list">
                          {upcomingFallback.map(m => (
                            <MatchCard key={m.id} match={m} to={`/match/${m.id}`} showDate />
                          ))}
                        </div>
                      </>
                    )
                  }
                  return (
                    <div className="empty">
                      <div className="empty-icon" aria-hidden="true">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="18" rx="2"/>
                          <path d="M16 2v4M8 2v4M3 10h18"/>
                        </svg>
                      </div>
                      <div className="empty-title">Nothing scheduled</div>
                      <div className="empty-sub">
                        {tab !== 'all'
                          ? 'Try another tab.'
                          : isViewingToday
                            ? 'Pick a different day above.'
                            : 'Pick a different day or jump back to today.'}
                      </div>
                    </div>
                  )
                }
                return (
                  <div className="match-list">
                    {list.map(m => (
                      <MatchCard key={m.id} match={m} to={`/match/${m.id}`} showDate={tab !== 'all'} />
                    ))}
                  </div>
                )
              })()}
            </section>

            {/* Groups */}
            {(tab === 'all' || isSearching) && filtered.groups.length > 0 && (
              <section className="section">
                <div className="section-head">
                  <h2 className="section-title">
                    Groups
                    <span className="badge-count">{filtered.groups.length} of 12</span>
                  </h2>
                  <span className="section-aux">Top 2 advance · 8 best 3rd-placed qualify</span>
                </div>
                <div className="groups-grid">
                  {filtered.groups.map(g => {
                    const groupMatches = matches.filter(m => m.group === g.id)
                    const standings = standingsByGroup[g.id] || []
                    return <GroupCard key={g.id} group={g} standings={standings} groupMatches={groupMatches} />
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      <Footer />
    </div>
  )
}

// Friendly heading when viewing a non-today date — "Saturday, Jun 21".
function matchesHeading(iso) {
  // iso is "MMM D" — pair with the current year (2026) and a wall-clock date.
  const [mon, day] = iso.split(' ')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const mIdx = months.indexOf(mon)
  if (mIdx < 0) return iso
  const d = new Date(2026, mIdx, Number(day) || 1)
  const dows = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  return `${dows[d.getDay()]}, ${iso}`
}

function FeedLoadingState() {
  return (
    <>
      <section className="section" aria-busy="true" aria-label="Loading matches">
        <div className="section-head">
          <div className="skel skel-title" />
        </div>
        <div className="match-list">
          {Array.from({ length: 4 }).map((_, i) => (
            <MatchCardSkeleton key={i} />
          ))}
        </div>
      </section>
      <section className="section" aria-hidden="true">
        <div className="section-head">
          <div className="skel skel-title" />
        </div>
        <div className="groups-grid">
          {Array.from({ length: 3 }).map((_, i) => (
            <GroupCardSkeleton key={i} />
          ))}
        </div>
      </section>
      <div className="loading-overlay-tip">
        <Spinner /> <span>Loading fixtures…</span>
      </div>
    </>
  )
}

function applyQuery(matches, groups, query, teams, venues) {
  const q = query.trim().toLowerCase()
  if (!q) return { matches, groups }

  const teamHit = (code) => {
    const t = teams && teams[code]
    if (!t) return false
    return (t.name || '').toLowerCase().includes(q)
        || (t.short || '').toLowerCase().includes(q)
        || (t.code || '').toLowerCase().includes(q)
  }
  const venueHit = (short) => ((venues && venues[short]) || short || '').toLowerCase().includes(q)
  const groupHit = (g) =>
    `group ${g.id}`.toLowerCase().includes(q) ||
    (g.id || '').toLowerCase() === q ||
    (g.teams || []).some(teamHit)

  return {
    matches: matches.filter(m =>
      teamHit(m.home) || teamHit(m.away) || venueHit(m.venueShort) ||
      `group ${m.group}`.toLowerCase().includes(q) ||
      (m.group || '').toLowerCase() === q
    ),
    groups: groups.filter(groupHit),
  }
}
