import { useEffect, useMemo, useState } from 'react'
import { getGroups, getMatches, getStandings, getVenues } from '../api/scores.js'
import { getNow, formatShortDate, formatLongEyebrow } from '../api/clock.js'
import { useTeams } from '../api/providers.jsx'
import Header from '../components/Header.jsx'
import Intro from '../components/Intro.jsx'
import DateStrip from '../components/DateStrip.jsx'
import Tabs from '../components/Tabs.jsx'
import MatchCard from '../components/MatchCard.jsx'
import GroupCard from '../components/GroupCard.jsx'
import { LiveSection } from '../components/LiveCard.jsx'

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

  const now = getNow()
  const todayIso = formatShortDate(now)
  const longDate = formatLongEyebrow(now)
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayIso = formatShortDate(yesterday)

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

  const todayMatchday = useMemo(() => {
    const m = matches.find((x) => dateKey(x) === todayIso)
    return m ? m.md : null
  }, [matches, todayIso])

  const eyebrow = todayMatchday ? `${longDate} · Matchday ${todayMatchday}` : longDate

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

  const feedByTab = useMemo(() => {
    let pool = filtered.matches
    if (tab === 'live')           pool = pool.filter(m => m.status === 'LIVE' || m.status === 'HT')
    else if (tab === 'today')     pool = pool.filter(m => dateKey(m) === todayIso)
    else if (tab === 'yesterday') pool = pool.filter(m => dateKey(m) === yesterdayIso)
    else if (tab === 'upcoming')  pool = pool.filter(m => m.status === 'SCHED')
    return [...pool].sort((a, b) => {
      const order = { LIVE: 0, HT: 0, SCHED: 1, FT: 2, PP: 3, CXL: 3 }
      return (order[a.status] ?? 9) - (order[b.status] ?? 9)
    })
  }, [filtered.matches, tab, todayIso, yesterdayIso])

  const noResults = isSearching && filtered.matches.length === 0 && filtered.groups.length === 0

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
        <Intro matches={matches} todayIso={todayIso} eyebrow={eyebrow} />
        <DateStrip matches={matches} todayIso={todayIso} />

        {error && matches.length === 0 ? (
          <section className="section">
            <div className="empty">
              <div className="empty-title">Couldn't load matches. Check your connection and try again.</div>
              <div className="empty-sub" style={{marginTop:12}}>
                <button onClick={retry} className="tab active">Retry</button>
              </div>
            </div>
          </section>
        ) : loading && matches.length === 0 ? (
          <section className="section">
            <div className="empty">
              <div className="empty-title">Loading matches…</div>
            </div>
          </section>
        ) : noResults ? (
          <section className="section">
            <div className="empty">
              <div className="empty-title">No results for "{query}"</div>
              <div className="empty-sub">Try a team name (e.g. Brazil), code (BRA), group letter (C), or city.</div>
            </div>
          </section>
        ) : (
          <>
            {/* Live now */}
            {!isSearching && tab === 'all' && <LiveSection matches={matches} venues={venues} />}

            {/* Today's matches OR filtered feed */}
            <section className="section">
              <div className="section-head">
                <h2 className="section-title">
                  {tab === 'all' && (isSearching ? 'Matches' : "Today's matches")}
                  {tab === 'live' && 'Live matches'}
                  {tab === 'today' && "Today's matches"}
                  {tab === 'yesterday' && 'Yesterday'}
                  {tab === 'upcoming' && 'Upcoming'}
                  <span className="badge-count">{tab === 'all' && !isSearching
                    ? matches.filter(m => dateKey(m) === todayIso).length
                    : feedByTab.length}</span>
                </h2>
                <div className="section-controls">
                  <Tabs active={tab} onChange={setTab} counts={counts} />
                </div>
              </div>

              {(() => {
                const list = (tab === 'all' && !isSearching)
                  ? matches.filter(m => dateKey(m) === todayIso)
                              .sort((a, b) => {
                                const order = { LIVE: 0, HT: 0, SCHED: 1, FT: 2, PP: 3, CXL: 3 }
                                return (order[a.status] ?? 9) - (order[b.status] ?? 9)
                              })
                  : feedByTab
                if (list.length === 0) {
                  return (
                    <div className="empty">
                      <div className="empty-title">Nothing scheduled here</div>
                      <div className="empty-sub">Try another tab.</div>
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

function Footer() {
  return (
    <footer className="footer">
      <div className="shell">
        <p className="footer-line">
          2026 FIFA World Cup
          <span className="dot">·</span>
          Canada · Mexico · United States
          <span className="dot">·</span>
          June 11 – July 19
        </p>
        <p className="footer-line footer-attribution">
          © 2026 <strong>ACLOUDBREW STUDIOS LLC</strong>
          <span className="dot">·</span>
          All rights reserved
          <span className="dot">·</span>
          <a href="mailto:acloudbrew@proton.me">acloudbrew@proton.me</a>
        </p>
        <p className="footer-line footer-fine">
          Not affiliated with FIFA. Live scores, fixtures and group standings updated in real time.
        </p>
      </div>
    </footer>
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
