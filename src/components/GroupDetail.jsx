import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getGroups, getMatches, getStandings } from '../api/scores.js'
import { CountryCrest } from './Flag.jsx'
import MatchCard from './MatchCard.jsx'
import { useTeams } from '../api/providers.jsx'
import { formatShortDate } from '../api/clock.js'
import { track } from '../api/analytics.js'
import { PageSpinner } from './Spinner.jsx'
import AdSlot from './AdSlot.jsx'
import { adsConfig } from '../api/ads.js'

const shortDate = (iso) => {
  if (!iso) return ''
  try { return formatShortDate(new Date(iso)) } catch { return '' }
}

export default function GroupDetail() {
  const { groupId } = useParams()
  const { teams } = useTeams()
  const [group, setGroup] = useState(null)
  const [standings, setStandings] = useState([])
  const [groupMatches, setGroupMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    setNotFound(false)
    Promise.all([
      getGroups(),
      getStandings(groupId),
      getMatches({ group: groupId }),
    ])
      .then(([groups, s, m]) => {
        if (!alive) return
        const g = groups.find((x) => x.id === groupId)
        if (!g) {
          setNotFound(true)
          setLoading(false)
          return
        }
        setGroup(g)
        setStandings(s)
        setGroupMatches([...m].sort((a, b) => (a.kickoff_iso || '').localeCompare(b.kickoff_iso || '')))
        setLoading(false)
        track('view_group', { group_id: g.id })
      })
      .catch((e) => {
        if (!alive) return
        setError(e)
        setLoading(false)
      })
    return () => { alive = false }
  }, [groupId, reloadKey])

  const retry = () => setReloadKey((k) => k + 1)

  if (notFound) {
    return (
      <div className="detail">
        <div className="shell">
          <div className="detail-hero">
            <h1>Group not found</h1>
            <p style={{padding:'1rem 0',color:'var(--ink-2)'}}>We couldn't find a group called {groupId}.</p>
            <Link to="/">Back to all groups</Link>
          </div>
        </div>
      </div>
    )
  }

  if (error && !group) {
    return (
      <div className="detail">
        <div className="shell">
          <div className="detail-hero">
            <h1>Couldn't load this group.</h1>
            <p style={{padding:'1rem 0',color:'var(--ink-2)'}}>Check your connection and try again.</p>
            <div style={{display:'flex',gap:12,alignItems:'center'}}>
              <button onClick={retry} className="tab active">Retry</button>
              <Link to="/">Back to all groups</Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (loading && !group) {
    return (
      <div className="detail">
        <div className="shell">
          <PageSpinner label="Loading group…" />
        </div>
      </div>
    )
  }

  if (!group) return null

  const liveCount = groupMatches.filter(m => m.status === 'LIVE' || m.status === 'HT').length
  const played = groupMatches.filter(m => m.status === 'FT').length
  const byMd = [1, 2, 3].map(md => groupMatches.filter(m => m.md === md))

  return (
    <div className="detail">
      <div className="shell">
        <div className="detail-hero">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link to="/" className="crumb">World Cup 2026</Link>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
            <span className="crumb is-current" aria-current="page">Groups</span>
          </nav>
          <h1>
            Group {group.id}
            <span className="label">{group.teams.map(t => teams[t]?.name || t).join(' · ')}</span>
          </h1>
          <div className="summary">
            <span>4 teams</span>
            <span className="sep">·</span>
            <span>6 matches</span>
            <span className="sep">·</span>
            <span>{played} played</span>
            {liveCount > 0 && <>
              <span className="sep">·</span>
              <span className="has-live">{liveCount} live</span>
            </>}
          </div>
        </div>
      </div>

      <div className="shell">
        <section className="section">
          <div className="section-head">
            <h2 className="section-title">Standings</h2>
          </div>
          <div className="standings">
            <table>
              <thead>
                <tr>
                  <th>Team</th>
                  <th>P</th>
                  <th>W</th>
                  <th>D</th>
                  <th>L</th>
                  <th>GF</th>
                  <th>GA</th>
                  <th>GD</th>
                  <th>Pts</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row, i) => {
                  const pos = row.pos ?? (i + 1)
                  const cls = pos <= 2 ? 'qual' : pos === 3 ? 'maybe' : ''
                  return (
                    <tr key={row.team} className={cls}>
                      <td>
                        <div className="team-cell">
                          <span className="pos-cell">{pos}</span>
                          <CountryCrest team={row.team} variant="sm" />
                          <span className="country">{teams[row.team]?.name || row.team}</span>
                        </div>
                      </td>
                      <td>{row.pld}</td>
                      <td>{row.w}</td>
                      <td>{row.d}</td>
                      <td>{row.l}</td>
                      <td>{row.gf}</td>
                      <td>{row.ga}</td>
                      <td>{row.gd > 0 ? `+${row.gd}` : row.gd}</td>
                      <td className="pts">{row.pts}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="legend">
              <span><i style={{background:'var(--ink-0)'}}/>Advance to knockout</span>
              <span><i style={{background:'var(--ink-4)'}}/>Best 3rd-placed (8 of 12)</span>
            </div>
          </div>
        </section>

        <AdSlot slot={adsConfig.slots.group} label="Sponsored" />

        {byMd.map((md, i) => (
          <section className="section md-section" key={i}>
            <h3>
              Matchday {i + 1}
              <span className="md-date">{md[0] && shortDate(md[0].kickoff_iso)}</span>
            </h3>
            <div className="match-list">
              {md.map(m => <MatchCard key={m.id} match={m} to={`/match/${m.id}`} showDate={false} />)}
            </div>
          </section>
        ))}

        <AdSlot slot={adsConfig.slots.group} label="Sponsored" />
      </div>
    </div>
  )
}
