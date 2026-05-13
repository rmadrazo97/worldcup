import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getMatchById, getMatchDetails, getVenues } from '../api/scores.js'
import { subscribeMatch, subscribeMatchDetails } from '../api/live.js'
import { useTeam } from '../api/providers.jsx'
import { Flag } from './Flag.jsx'
import LineupView from './LineupView.jsx'
import StatsView from './StatsView.jsx'
import TimelineView from './TimelineView.jsx'

function kickoffLabel(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    })
  } catch {
    return ''
  }
}

export default function MatchDetail() {
  const { matchId } = useParams()
  const [match, setMatch] = useState(null)
  const [details, setDetails] = useState(null)
  const [venuesMap, setVenuesMap] = useState({})
  const [tab, setTab] = useState('lineup')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  // Fetch venues once — small, cached.
  useEffect(() => {
    let alive = true
    getVenues()
      .then(v => { if (alive) setVenuesMap(v || {}) })
      .catch(() => { /* non-fatal: venue label gracefully degrades to short */ })
    return () => { alive = false }
  }, [])

  // Initial paint via callables; if LIVE, attach Firestore listeners.
  useEffect(() => {
    let alive = true
    let unsubMatch = () => {}
    let unsubDetails = () => {}

    setLoading(true)
    setError(null)
    setNotFound(false)

    Promise.all([getMatchById(matchId), getMatchDetails(matchId)])
      .then(([m, d]) => {
        if (!alive) return
        if (!m) {
          setNotFound(true)
          setLoading(false)
          return
        }
        setMatch(m)
        setDetails(d)
        setLoading(false)
        if (m.status === 'LIVE' || m.status === 'HT') {
          unsubMatch = subscribeMatch(matchId, (next) => {
            if (!alive || !next) return
            setMatch(next)
            // Tear down listeners once we transition out of live.
            if (next.status !== 'LIVE' && next.status !== 'HT') {
              unsubMatch && unsubMatch()
              unsubDetails && unsubDetails()
              unsubMatch = () => {}
              unsubDetails = () => {}
            }
          })
          unsubDetails = subscribeMatchDetails(matchId, (next) => {
            if (!alive || !next) return
            setDetails(next)
          })
        }
      })
      .catch((e) => {
        if (!alive) return
        setError(e)
        setLoading(false)
      })

    return () => {
      alive = false
      unsubMatch && unsubMatch()
      unsubDetails && unsubDetails()
    }
  }, [matchId, reloadKey])

  const homeTeam = useTeam(match?.home || '')
  const awayTeam = useTeam(match?.away || '')

  if (notFound) {
    return (
      <div className="match-detail">
        <div className="shell">
          <div className="detail-fallback">
            <h4>Match not found</h4>
            <p>We couldn't find a match with id "{matchId}".</p>
            <Link to="/">Back to home</Link>
          </div>
        </div>
      </div>
    )
  }
  if (error && !match) {
    return (
      <div className="match-detail">
        <div className="shell">
          <div className="detail-fallback">
            <h4>Couldn't load this match</h4>
            <p>Something went wrong. Please try again.</p>
            <button onClick={() => setReloadKey((k) => k + 1)}>Retry</button>
            {' '}<Link to="/">Back to home</Link>
          </div>
        </div>
      </div>
    )
  }
  if (loading || !match) {
    return (
      <div className="match-detail">
        <div className="shell">
          <p style={{ padding: '2rem 0', color: 'var(--ink-3)' }}>Loading match…</p>
        </div>
      </div>
    )
  }

  const isLive  = match.status === 'LIVE'
  const isHT    = match.status === 'HT'
  const isFT    = match.status === 'FT'
  const isSched = match.status === 'SCHED'
  const isPP    = match.status === 'PP'
  const isCXL   = match.status === 'CXL'
  const venueLabel = venuesMap[match.venueShort] || match.venueShort || 'Stadium'

  return (
    <div className="match-detail">
      <div className="shell">

        <div className="summary-card">
          <div className="summary-status">
            {isLive && (
              <span className="live-chip">
                <span className="dot" />
                <span>{match.minute ? `Live · ${match.minute}` : 'Live'}</span>
              </span>
            )}
            {isHT && (
              <span className="live-chip">
                <span className="dot" />
                <span>Half time</span>
              </span>
            )}
            {isFT && (
              <span className="live-chip is-final">
                <span className="dot" />
                <span>Full time</span>
              </span>
            )}
            {isSched && (
              <span className="live-chip is-sched">
                <span className="dot" />
                <span>{kickoffLabel(match.kickoff_iso)}</span>
              </span>
            )}
            {isPP && (
              <span className="live-chip is-sched">
                <span className="dot" />
                <span>Postponed</span>
              </span>
            )}
            {isCXL && (
              <span className="live-chip is-sched">
                <span className="dot" />
                <span>Cancelled</span>
              </span>
            )}
          </div>
          <div className="summary-body">
            <div className="summary-team">
              <span className="crest-lg"><Flag team={match.home} size="lg" /></span>
              <span className="t-name-lg">{homeTeam.name}</span>
              <span className="t-side">Group {match.group}</span>
            </div>
            <div className="summary-score">
              {(isSched || isPP || isCXL) ? (
                <>
                  <span>—</span><span className="sep">vs</span><span>—</span>
                </>
              ) : (
                <>
                  <span>{match.hs}</span>
                  <span className="sep">–</span>
                  <span>{match.as}</span>
                </>
              )}
            </div>
            <div className="summary-team">
              <span className="crest-lg"><Flag team={match.away} size="lg" /></span>
              <span className="t-name-lg">{awayTeam.name}</span>
              <span className="t-side">Group {match.group}</span>
            </div>
          </div>
          <div className="summary-foot">
            <span className="left">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              {venueLabel}
            </span>
          </div>
        </div>

        <div className="detail-tabs">
          <button className={'detail-tab' + (tab === 'lineup' ? ' active' : '')} onClick={() => setTab('lineup')}>Line up</button>
          <button className={'detail-tab' + (tab === 'stats'  ? ' active' : '')} onClick={() => setTab('stats')}>Statistics</button>
          <button className={'detail-tab' + (tab === 'timeline' ? ' active' : '')} onClick={() => setTab('timeline')}>Timeline</button>
        </div>

        {tab === 'lineup'   && <LineupView   match={match} details={details} />}
        {tab === 'stats'    && <StatsView    match={match} details={details} />}
        {tab === 'timeline' && <TimelineView match={match} details={details} />}
      </div>
    </div>
  )
}
