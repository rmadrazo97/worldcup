// Pure mappers for group standings.
// Mirrors docs/plan/02-data-contracts.md § 3.7 (mapStanding) and § 10 (fallback).

import type { FIFAStanding } from '../upstream/types.js'
import type { Match, Standing } from '../internal/types.js'
import { mapTeam } from './team.js'

export interface StandingWithMeta extends Standing {
  groupId: string
  season: number
  teamShort: string
}

function groupLetterFromName(groupName: string | null | undefined): string {
  if (!groupName) return ''
  const parts = groupName.trim().split(/\s+/)
  const last = parts[parts.length - 1] ?? ''
  return last.toUpperCase()
}

/**
 * Pure mapper: upstream FIFAStanding → internal Standing (with metadata).
 *
 * Returns a Standing extended with `groupId` (letter), `season` and
 * `teamShort` so the caller can bucket per group and surface as the
 * canonical Standings docs.
 */
export function mapStanding(s: FIFAStanding): StandingWithMeta {
  const team = mapTeam(s.team)
  return {
    team: team.short,
    teamShort: team.short,
    teamId: s.team.id,
    pld: s.played,
    w: s.won,
    d: s.drawn,
    l: s.lost,
    gf: s.goals_for,
    ga: s.goals_against,
    gd: s.goal_difference,
    pts: s.points,
    pos: s.position,
    groupId: groupLetterFromName(s.group.name),
    season: s.season.year,
  }
}

/**
 * Fallback standings computation used when `/group_standings` is
 * unavailable (5xx, tier denied, rate-limited). Mirrors the algorithm
 * in `src/api/scores.js` per docs/plan § 10.
 *
 * Tiebreakers: pts desc → gd desc → gf desc → team short alphabetical.
 * Pure: no I/O, deterministic.
 */
export function computeStandings(matches: Match[], groupId: string): Standing[] {
  const rows = new Map<string, Standing & { teamId: number }>()

  const ensure = (
    short: string,
    teamId: number,
  ): Standing & { teamId: number } => {
    let row = rows.get(short)
    if (!row) {
      row = {
        team: short,
        teamId,
        pld: 0,
        w: 0,
        d: 0,
        l: 0,
        gf: 0,
        ga: 0,
        gd: 0,
        pts: 0,
        pos: 0,
      }
      rows.set(short, row)
    }
    return row
  }

  for (const m of matches) {
    if (m.status !== 'FT') continue
    if (m.group !== groupId) continue
    if (m.hs == null || m.as == null) continue
    const h = ensure(m.home, m.homeId)
    const a = ensure(m.away, m.awayId)
    h.pld++
    a.pld++
    h.gf += m.hs
    h.ga += m.as
    a.gf += m.as
    a.ga += m.hs
    if (m.hs > m.as) {
      h.w++
      a.l++
      h.pts += 3
    } else if (m.hs < m.as) {
      a.w++
      h.l++
      a.pts += 3
    } else {
      h.d++
      a.d++
      h.pts++
      a.pts++
    }
  }

  const list = Array.from(rows.values())
  for (const r of list) r.gd = r.gf - r.ga

  list.sort(
    (x, y) =>
      y.pts - x.pts ||
      y.gd - x.gd ||
      y.gf - x.gf ||
      x.team.localeCompare(y.team),
  )

  return list.map((r, i) => ({
    team: r.team,
    teamId: r.teamId,
    pld: r.pld,
    w: r.w,
    d: r.d,
    l: r.l,
    gf: r.gf,
    ga: r.ga,
    gd: r.gd,
    pts: r.pts,
    pos: i + 1,
  }))
}
