import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getMatchById, getMatchDetails, getVenues } from '../api/scores.js'
import { subscribeMatch, subscribeMatchDetails } from '../api/live.js'
import { useTeam } from '../api/providers.jsx'
import { Flag } from './Flag.jsx'
import LineupView from './LineupView.jsx'
import StatsView from './StatsView.jsx'
import TimelineView from './TimelineView.jsx'
import { PageSpinner } from './Spinner.jsx'
import { MatchDetailSkeleton } from './Skeleton.jsx'
import { track } from '../api/analytics.js'
import AdSlot from './AdSlot.jsx'
import { adsConfig } from '../api/ads.js'

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
        track('view_match', { match_id: m.id, status: m.status, group: m.group })
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
          <MatchDetailSkeleton />
          <PageSpinner label="Loading match…" />
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
  const homeWon = isFT && match.hs > match.as
  const awayWon = isFT && match.as > match.hs
  const isDraw  = isFT && match.hs === match.as

  return (
    <div className="match-detail">
      <div className="shell">
        <nav className="breadcrumb match-breadcrumb" aria-label="Breadcrumb">
          <Link to="/" className="crumb">World Cup 2026</Link>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
          <Link to={`/group/${match.group}`} className="crumb">Group {match.group}</Link>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
          <span className="crumb is-current" aria-current="page">{homeTeam.short} v {awayTeam.short}</span>
        </nav>

        <div className={'summary-card' + (isLive || isHT ? ' is-live' : '') + (isFT ? ' is-ft' : '')}>
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
            <div className={'summary-team' + (homeWon ? ' is-winner' : (awayWon ? ' is-loser' : ''))}>
              <span className="crest-lg"><Flag team={match.home} size="lg" /></span>
              <span className="t-name-lg">{homeTeam.name}</span>
              <span className="t-side">{homeWon ? 'Winner' : awayWon ? 'Lost' : isDraw ? 'Drew' : 'Home'}</span>
            </div>
            <div className="summary-score">
              {(isSched || isPP || isCXL) ? (
                <>
                  <span>—</span><span className="sep">vs</span><span>—</span>
                </>
              ) : (
                <>
                  <span className={homeWon ? 'w' : awayWon ? 'l' : ''}>{match.hs}</span>
                  <span className="sep">–</span>
                  <span className={awayWon ? 'w' : homeWon ? 'l' : ''}>{match.as}</span>
                </>
              )}
            </div>
            <div className={'summary-team' + (awayWon ? ' is-winner' : (homeWon ? ' is-loser' : ''))}>
              <span className="crest-lg"><Flag team={match.away} size="lg" /></span>
              <span className="t-name-lg">{awayTeam.name}</span>
              <span className="t-side">{awayWon ? 'Winner' : homeWon ? 'Lost' : isDraw ? 'Drew' : 'Away'}</span>
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

        {/* Slot between summary and tabs — never inside the live scoreboard. */}
        {!isLive && !isHT && <AdSlot slot={adsConfig.slots.match} label="Sponsored" />}

        <div className="detail-tabs" role="tablist" aria-label="Match details">
          <button role="tab" aria-selected={tab === 'lineup'} className={'detail-tab' + (tab === 'lineup' ? ' active' : '')} onClick={() => { setTab('lineup'); track('match_tab', { match_id: match.id, tab: 'lineup' }) }}>Line up</button>
          <button role="tab" aria-selected={tab === 'stats'}  className={'detail-tab' + (tab === 'stats'  ? ' active' : '')} onClick={() => { setTab('stats');  track('match_tab', { match_id: match.id, tab: 'stats' }) }}>Statistics</button>
          <button role="tab" aria-selected={tab === 'timeline'} className={'detail-tab' + (tab === 'timeline' ? ' active' : '')} onClick={() => { setTab('timeline'); track('match_tab', { match_id: match.id, tab: 'timeline' }) }}>Timeline</button>
        </div>

        {tab === 'lineup'   && <LineupView   match={match} details={details} />}
        {tab === 'stats'    && <StatsView    match={match} details={details} />}
        {tab === 'timeline' && <TimelineView match={match} details={details} />}

        <AdSlot slot={adsConfig.slots.match} label="Sponsored" />
      </div>
    </div>
  )
}
