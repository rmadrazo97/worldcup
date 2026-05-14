// Pure mapper: FIFAMatchLineupRow[] (upstream) → Lineup (internal v2).
// Mirrors docs/plan/02-data-contracts.md § 3.4.

import type { FIFAMatchLineupRow, FIFAPlayer } from '../upstream/types.js'
import type { Lineup, PlayerRef } from '../internal/types.js'

type Position = 'GK' | 'DF' | 'MF' | 'FW' | null

/**
 * Map an upstream single-letter position to the internal 2-letter code.
 * Falls through to `null` for unknown values.
 */
function mapPos(p: string | null | undefined): Position {
  if (!p) return null
  const code = p.toUpperCase()
  switch (code) {
    case 'G':
    case 'GK':
      return 'GK'
    case 'D':
    case 'DF':
      return 'DF'
    case 'M':
    case 'MF':
      return 'MF'
    case 'F':
    case 'FW':
      return 'FW'
    default:
      return null
  }
}

function parseJersey(p: FIFAPlayer): number | null {
  const j = p.jersey_number
  if (j == null) return null
  if (typeof j === 'number') return Number.isFinite(j) ? j : null
  const parsed = parseInt(j, 10)
  return Number.isNaN(parsed) ? null : parsed
}

function rowToPlayerRef(row: FIFAMatchLineupRow): PlayerRef {
  const p = row.player
  return {
    id: p.id,
    name: p.name,
    short_name: p.short_name,
    position: mapPos(row.position ?? p.position),
    n: row.shirt_number ?? parseJersey(p),
  }
}

/**
 * Pure mapper: upstream lineup rows for one team → internal Lineup.
 *
 * Args:
 *   rows      — full FIFAMatchLineupRow list for the match (both teams)
 *   teamId    — upstream team id we're mapping (filters rows)
 *   teamShort — internal 3-letter code for that team
 *
 * Starters are ordered by `shirt_number` ascending; subs likewise.
 * Formation is the first non-null `formation` value among the team's rows.
 * `coach` is null here — manager name lives on the parent FIFAMatch and
 * the composer (`match-details.ts`) attaches it externally.
 */
export function mapLineup(
  rows: FIFAMatchLineupRow[],
  teamId: number,
  teamShort: string,
): Lineup {
  const teamRows = rows.filter((r) => r.team_id === teamId)

  const formation =
    teamRows.find((r) => r.formation != null)?.formation ?? null

  const byShirt = (a: FIFAMatchLineupRow, b: FIFAMatchLineupRow): number => {
    const ax = a.shirt_number ?? Number.MAX_SAFE_INTEGER
    const bx = b.shirt_number ?? Number.MAX_SAFE_INTEGER
    return ax - bx
  }

  const starters = teamRows
    .filter((r) => r.is_starter)
    .sort(byShirt)
    .map(rowToPlayerRef)

  // Subs: explicit `is_substitute === true` OR (not a starter and not a sub flag at all).
  // We trust `is_substitute` when present; otherwise fall back to "not is_starter".
  const subs = teamRows
    .filter((r) => !r.is_starter && r.is_substitute)
    .sort(byShirt)
    .map(rowToPlayerRef)

  return {
    team: teamShort,
    formation,
    starters,
    subs,
    coach: null,
  }
}
