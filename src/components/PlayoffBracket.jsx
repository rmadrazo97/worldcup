import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CountryCrest, TeamName } from './Flag.jsx'

/**
 * Horizontal swipe-paginated knockout bracket.
 *
 * Each round is a full-width column. The user swipes / drags / scrolls
 * horizontally to advance through rounds. Position is also driven by the
 * sticky round tabs above. Within a round, matches are paired (top half
 * feeds into the next round's first slot, bottom half into the second).
 *
 * Match data may not exist yet for knockout stages — TBD placeholders are
 * generated from the standard 32→16→8→4→2→1 structure so the screen always
 * renders a coherent bracket.
 */

const ROUNDS = [
  { key: 'r32',   label: 'Round of 32', short: 'R32',   count: 16, dateRange: 'Jun 28 – Jul 3' },
  { key: 'r16',   label: 'Round of 16', short: 'R16',   count:  8, dateRange: 'Jul 4 – Jul 7'  },
  { key: 'qf',    label: 'Quarter-finals', short: 'QF', count:  4, dateRange: 'Jul 9 – Jul 11' },
  { key: 'sf',    label: 'Semi-finals',    short: 'SF', count:  2, dateRange: 'Jul 14 – Jul 15' },
  { key: 'final', label: 'Final',          short: 'F',  count:  1, dateRange: 'Jul 19' },
]

function formatKickoff(iso) {
  if (!iso) return null
  try {
    const d = new Date(iso)
    const date = d.toLocaleDateString([], { month: 'short', day: 'numeric' })
    const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    return { date, time, full: `${date}, ${time}` }
  } catch {
    return null
  }
}

// Synthesize a placeholder match for a slot when real data is absent.
function placeholderMatch(stageKey, idx) {
  return {
    id: `placeholder-${stageKey}-${idx}`,
    stage: stageKey,
    home: null,
    away: null,
    hs: null,
    as: null,
    status: 'SCHED',
    kickoff_iso: null,
    placeholder: true,
    homeLabel: 'TBD',
    awayLabel: 'TBD',
  }
}

function buildRound(stageKey, count, matches) {
  const stageMatches = matches.filter((m) => m.stage === stageKey)
  if (stageMatches.length === 0) {
    return Array.from({ length: count }, (_, i) => placeholderMatch(stageKey, i))
  }
  // Sort by kickoff so the column reads top-to-bottom by time.
  const sorted = [...stageMatches].sort((a, b) =>
    (a.kickoff_iso || '').localeCompare(b.kickoff_iso || ''),
  )
  if (sorted.length >= count) return sorted.slice(0, count)
  // Pad with placeholders if backend has partial data.
  const padded = sorted.slice()
  for (let i = sorted.length; i < count; i++) padded.push(placeholderMatch(stageKey, i))
  return padded
}

export default function PlayoffBracket({ matches = [] }) {
  const [activeIdx, setActiveIdx] = useState(0)
  const pagerRef = useRef(null)
  const pageRefs = useRef([])
  const programmaticScroll = useRef(false)
  const programmaticTimer = useRef(null)

  const rounds = useMemo(
    () => ROUNDS.map((r) => ({ ...r, matches: buildRound(r.key, r.count, matches) })),
    [matches],
  )

  // Scroll-driven active round via IntersectionObserver against the pager.
  useEffect(() => {
    const root = pagerRef.current
    if (!root) return
    const io = new IntersectionObserver(
      (entries) => {
        if (programmaticScroll.current) return
        let best = null
        for (const e of entries) {
          if (!best || e.intersectionRatio > best.intersectionRatio) best = e
        }
        if (best && best.isIntersecting) {
          const idx = Number(best.target.dataset.idx)
          if (!Number.isNaN(idx)) setActiveIdx(idx)
        }
      },
      { root, threshold: [0.55, 0.75, 0.95] },
    )
    pageRefs.current.forEach((el) => el && io.observe(el))
    return () => io.disconnect()
  }, [rounds.length])

  const goTo = (idx) => {
    const root = pagerRef.current
    const target = pageRefs.current[idx]
    if (!root || !target) return
    programmaticScroll.current = true
    setActiveIdx(idx)
    root.scrollTo({ left: target.offsetLeft, behavior: 'smooth' })
    clearTimeout(programmaticTimer.current)
    programmaticTimer.current = setTimeout(() => {
      programmaticScroll.current = false
    }, 600)
  }

  // Keyboard nav — arrows step through rounds.
  useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        goTo(Math.min(activeIdx + 1, rounds.length - 1))
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goTo(Math.max(activeIdx - 1, 0))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeIdx, rounds.length])

  // Keep the active tab visible in its scroller.
  useLayoutEffect(() => {
    const tabsEl = document.querySelector('.bracket-tabs')
    const active = tabsEl?.querySelector('.bracket-tab.is-active')
    active?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [activeIdx])

  return (
    <div className="bracket">
      <BracketTabs rounds={rounds} activeIdx={activeIdx} onSelect={goTo} />

      <div className="bracket-pager" ref={pagerRef}>
        {rounds.map((round, idx) => (
          <section
            key={round.key}
            ref={(el) => (pageRefs.current[idx] = el)}
            className={'bracket-round' + (round.key === 'final' ? ' is-final' : '')}
            data-idx={idx}
            aria-label={round.label}
          >
            <RoundHeader round={round} idx={idx} total={rounds.length} />

            {round.key === 'final' ? (
              <FinalCard match={round.matches[0]} />
            ) : (
              <div className="bracket-matches">
                {round.matches.map((m, mi) => (
                  <BracketMatchCard
                    key={m.id || `m-${mi}`}
                    match={m}
                    pairBottom={mi % 2 === 1}
                    pairTop={mi % 2 === 0}
                    isLast={mi === round.matches.length - 1}
                  />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      <BracketDots
        count={rounds.length}
        activeIdx={activeIdx}
        labels={rounds.map((r) => r.short)}
        onSelect={goTo}
      />
    </div>
  )
}

function BracketTabs({ rounds, activeIdx, onSelect }) {
  return (
    <div className="bracket-tabs" role="tablist" aria-label="Knockout rounds">
      {rounds.map((r, idx) => {
        const isActive = idx === activeIdx
        return (
          <button
            key={r.key}
            role="tab"
            aria-selected={isActive}
            type="button"
            className={'bracket-tab' + (isActive ? ' is-active' : '')}
            onClick={() => onSelect(idx)}
          >
            <span className="bracket-tab-num">{String(idx + 1).padStart(2, '0')}</span>
            <span className="bracket-tab-label">{r.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function RoundHeader({ round, idx, total }) {
  return (
    <div className="bracket-round-head">
      <div className="bracket-round-eyebrow">
        Stage {String(idx + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
        <span className="bracket-round-sep" aria-hidden="true">·</span>
        {round.dateRange}
      </div>
      <h2 className="bracket-round-title">{round.label}</h2>
      <div className="bracket-round-meta">
        {round.count} {round.count === 1 ? 'match' : 'matches'} · {round.count * 2} teams in
        {round.key !== 'final' && (
          <>
            <span className="bracket-round-sep" aria-hidden="true">·</span>
            {round.count} advance
          </>
        )}
      </div>
    </div>
  )
}

function BracketMatchCard({ match, pairTop, pairBottom, isLast }) {
  const kick = formatKickoff(match.kickoff_iso)
  const isFT = match.status === 'FT'
  const isLive = match.status === 'LIVE' || match.status === 'HT'
  const tbd = match.placeholder

  const homeWon = isFT && match.hs != null && match.as != null && match.hs > match.as
  const awayWon = isFT && match.hs != null && match.as != null && match.as > match.hs

  const Wrapper = match.id && !tbd ? Link : 'div'
  const wrapperProps = match.id && !tbd ? { to: `/match/${match.id}` } : {}

  return (
    <div
      className={
        'bracket-match' +
        (pairTop ? ' pair-top' : '') +
        (pairBottom ? ' pair-bottom' : '') +
        (isLast ? ' is-last' : '')
      }
    >
      <Wrapper
        {...wrapperProps}
        className={'bracket-card' + (tbd ? ' is-tbd' : '') + (isLive ? ' is-live' : '')}
      >
        <div className="bracket-card-head">
          <span className="bracket-card-when">
            {kick ? (
              <>
                <span className="bcw-date">{kick.date}</span>
                <span className="bcw-dot" aria-hidden="true">·</span>
                <span className="bcw-time">{kick.time}</span>
              </>
            ) : (
              <span className="bcw-tbd">TBD</span>
            )}
          </span>
          {isLive && (
            <span className="bracket-card-live">
              <span className="bcl-dot" aria-hidden="true" /> LIVE
            </span>
          )}
          {isFT && <span className="bracket-card-status">FT</span>}
        </div>

        <div className="bracket-card-teams">
          <TeamRow team={match.home} fallback={match.homeLabel || 'TBD'} score={match.hs} won={homeWon} lost={awayWon} />
          <TeamRow team={match.away} fallback={match.awayLabel || 'TBD'} score={match.as} won={awayWon} lost={homeWon} />
        </div>
      </Wrapper>

      {/* Bracket connector — extends from this card's mid-right to the join with its pair partner. */}
      <span className="bracket-connector" aria-hidden="true" />
    </div>
  )
}

function TeamRow({ team, fallback, score, won, lost }) {
  if (!team) {
    return (
      <div className="bracket-team is-tbd">
        <span className="bracket-team-crest tbd-crest" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-12V5l-8-3-8 3v5c0 8 8 12 8 12z" />
          </svg>
        </span>
        <span className="bracket-team-name">{fallback}</span>
        <span className="bracket-team-score" aria-hidden="true">—</span>
      </div>
    )
  }
  return (
    <div className={'bracket-team' + (won ? ' is-winner' : '') + (lost ? ' is-loser' : '')}>
      <span className="bracket-team-crest">
        <CountryCrest team={team} variant="sm" />
      </span>
      <TeamName team={team} dim={lost} />
      <span className="bracket-team-score">{score == null ? '' : score}</span>
    </div>
  )
}

function FinalCard({ match }) {
  const kick = formatKickoff(match?.kickoff_iso)
  const tbd = !match || match.placeholder
  return (
    <div className="bracket-final">
      <div className="bracket-final-glow" aria-hidden="true" />
      <div className="bracket-final-trophy" aria-hidden="true">
        <svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6h24v10a12 12 0 0 1-24 0V6z" />
          <path d="M20 10H10v6a8 8 0 0 0 10 8" />
          <path d="M44 10h10v6a8 8 0 0 1-10 8" />
          <path d="M26 36c0 4 2 6 6 6s6-2 6-6" />
          <path d="M22 56h20" />
          <path d="M28 56v-8h8v8" />
        </svg>
      </div>

      <div className="bracket-final-eyebrow">{kick ? kick.full : 'Jul 19, 2026'}</div>
      <div className="bracket-final-title">FIFA World Cup Final</div>

      <div className="bracket-final-card">
        <TeamRow team={match?.home} fallback="WINNER SF1" score={match?.hs} />
        <div className="bracket-final-vs">VS</div>
        <TeamRow team={match?.away} fallback="WINNER SF2" score={match?.as} />
      </div>

      <div className="bracket-final-foot">
        {tbd ? 'Champion will be crowned at MetLife Stadium' : 'MetLife Stadium · East Rutherford'}
      </div>
    </div>
  )
}

function BracketDots({ count, activeIdx, labels, onSelect }) {
  return (
    <div className="bracket-dots" role="tablist" aria-label="Round indicator">
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          role="tab"
          aria-selected={i === activeIdx}
          aria-label={`Go to ${labels[i]}`}
          className={'bracket-dot' + (i === activeIdx ? ' is-active' : '') + (i < activeIdx ? ' is-past' : '')}
          onClick={() => onSelect(i)}
        >
          <span className="bracket-dot-mark" />
          <span className="bracket-dot-label">{labels[i]}</span>
        </button>
      ))}
    </div>
  )
}
