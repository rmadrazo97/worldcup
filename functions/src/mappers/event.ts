// Pure mapper: FIFAMatchEvent (upstream) → MatchEvent | null (internal v2).
// Mirrors docs/plan/02-data-contracts.md § 3.5.
//
// Many upstream events are dropped (returns null): mid-match VAR
// decisions, injuryTime markers, rescinded events, anything we don't
// model. Callers should `.filter(Boolean)` the resulting array.

import type { FIFAMatchEvent, FIFAPlayer } from '../upstream/types.js'
import type { EventType, MatchEvent } from '../internal/types.js'

export interface EventCtx {
  homeShort: string
  awayShort: string
}

function playerLabel(p: FIFAPlayer | null | undefined): string | undefined {
  if (!p) return undefined
  return p.short_name ?? p.name
}

function minLabel(timeMinute: number | null, added: number | null): string {
  if (timeMinute == null) return ''
  if (added != null && added > 0 && added !== 999) {
    return `${timeMinute}'+${added}`
  }
  return `${timeMinute}'`
}

function teamFor(e: FIFAMatchEvent, ctx: EventCtx): string {
  return e.is_home ? ctx.homeShort : ctx.awayShort
}

interface RawEvent extends FIFAMatchEvent {
  // Some upstream payloads include these — they're not on the canonical
  // type but the mapper inspects them for completeness.
  rescinded?: boolean | null
  player_in?: FIFAPlayer | null
  player_out?: FIFAPlayer | null
  shootout_sequence?: number | null
}

function isPeriodMarker(e: FIFAMatchEvent): EventType | null {
  if (e.incident_type !== 'period') return null
  // The captured upstream encodes period markers via `time_minute`:
  //   45  → first half end → 'half'
  //   90  → second half end → 'full'
  //  105  → ET first half end → 'et_half'
  //  120  → ET second half end → 'et_full'
  // Some payloads carry an explicit `incident_class` or `period`; check both.
  const klass = (e.incident_class ?? '').toLowerCase()
  if (klass.includes('first_half_end') || klass === 'firsthalfend') return 'half'
  if (klass.includes('second_half_end') || klass === 'secondhalfend') return 'full'
  if (klass.includes('extra_time_first_half_start') || klass === 'extratimefirsthalfstart') return 'et_start'
  if (klass.includes('extra_time_first_half_end') || klass === 'extratimefirsthalfend') return 'et_half'
  if (klass.includes('extra_time_second_half_end') || klass === 'extratimesecondhalfend') return 'et_full'
  if (klass.includes('penalty_shootout_start') || klass === 'penaltyshootoutstart') return 'pen_start'
  // Heuristic by minute when class is null.
  switch (e.time_minute) {
    case 45:
      return 'half'
    case 90:
      return 'full'
    case 105:
      return 'et_half'
    case 120:
      return 'et_full'
    default:
      return null
  }
}

/**
 * Pure mapper: upstream FIFAMatchEvent → internal MatchEvent or null.
 * Returns null for events the internal model doesn't surface
 * (varDecision, injuryTime, rescinded, unknown incident_type).
 */
export function mapEvent(
  e: FIFAMatchEvent,
  ctx: EventCtx,
): MatchEvent | null {
  const raw = e as RawEvent
  if (raw.rescinded === true) return null

  const incident = e.incident_type
  const klass = (e.incident_class ?? '').toLowerCase()
  const min = minLabel(e.time_minute, e.added_time)

  // Period markers — no team, no player
  if (incident === 'period') {
    const type = isPeriodMarker(e)
    if (!type) return null
    return { type, min, team: null }
  }
  if (incident === 'firstHalfEnd') return { type: 'half', min, team: null }
  if (incident === 'secondHalfEnd') return { type: 'full', min, team: null }
  if (incident === 'extraTimeFirstHalfStart') return { type: 'et_start', min, team: null }
  if (incident === 'extraTimeFirstHalfEnd') return { type: 'et_half', min, team: null }
  if (incident === 'extraTimeSecondHalfEnd') return { type: 'et_full', min, team: null }
  if (incident === 'penaltyShootoutStart') return { type: 'pen_start', min, team: null }

  // Goals — discriminate by incident_class
  if (incident === 'goal') {
    const team = teamFor(e, ctx)
    const score =
      e.home_score != null && e.away_score != null
        ? `${e.home_score}-${e.away_score}`
        : undefined
    const player = playerLabel(e.player)
    const assist = playerLabel(e.assist_player)
    let type: EventType = 'goal'
    if (klass === 'own_goal' || klass === 'owngoal') type = 'own_goal'
    else if (klass === 'penalty') type = 'penalty_goal'
    // goalAwarded (e.g. VAR-awarded after review) is treated as a regular goal.
    const ev: MatchEvent = { type, min, team }
    if (player) ev.player = player
    if (assist && (type === 'goal' || type === 'penalty_goal')) ev.assist = assist
    if (score) ev.score = score
    return ev
  }

  // Penalty missed (not in shootout)
  if (incident === 'penaltyMissed') {
    const team = teamFor(e, ctx)
    const ev: MatchEvent = { type: 'penalty_missed', min, team }
    const player = playerLabel(e.player)
    if (player) ev.player = player
    return ev
  }

  // Cards
  if (incident === 'card' || incident === 'yellowCard' || incident === 'redCard') {
    const team = teamFor(e, ctx)
    let type: EventType
    if (incident === 'yellowCard' || klass === 'yellow') type = 'yellow'
    else if (incident === 'redCard' || klass === 'red') type = 'red'
    else if (klass === 'second_yellow' || klass === 'secondyellow' || klass === 'yellow_red' || klass === 'yellowred')
      type = 'second_yellow'
    else type = 'yellow'
    const ev: MatchEvent = { type, min, team }
    const player = playerLabel(e.player)
    if (player) ev.player = player
    return ev
  }

  // Substitution
  if (incident === 'substitution') {
    const team = teamFor(e, ctx)
    const ev: MatchEvent = { type: 'sub', min, team }
    // Upstream variants: `player_in`/`player_out` (real fixture) or
    // `related_player`/`player` (older spec). Cover both.
    const off =
      playerLabel(raw.player_out) ?? playerLabel(e.player) ?? undefined
    const on =
      playerLabel(raw.player_in) ??
      playerLabel((e as { related_player?: FIFAPlayer | null }).related_player ?? null) ??
      undefined
    if (off) ev.playerOff = off
    if (on) ev.playerOn = on
    return ev
  }

  // Shootout kicks
  if (incident === 'penaltyShootout' || incident === 'penaltyShootoutKick') {
    const team = teamFor(e, ctx)
    const ev: MatchEvent = { type: 'shootout_kick', min, team }
    const player = playerLabel(e.player)
    if (player) ev.player = player
    return ev
  }

  // Everything else (varDecision, injuryTime, unknown) — drop.
  return null
}
