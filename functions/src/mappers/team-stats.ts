// Pure mapper: FIFATeamMatchStats[] (upstream) → MatchStats (internal v2).
// Mirrors docs/plan/02-data-contracts.md § 3.6.

import type { FIFATeamMatchStats } from '../upstream/types.js'
import type { MatchStats } from '../internal/types.js'

function passAccuracy(row: FIFATeamMatchStats): number | null {
  const t = row.passes_total
  const a = row.passes_accurate
  if (t == null || a == null || t === 0) return null
  return Math.round((a / t) * 100)
}

interface LabelSpec {
  label: string
  pick: (row: FIFATeamMatchStats) => number | null
}

const CANONICAL_LABELS: LabelSpec[] = [
  { label: 'Possession', pick: (r) => r.possession_pct },
  { label: 'Shots', pick: (r) => r.shots_total },
  { label: 'On target', pick: (r) => r.shots_on_target },
  { label: 'Corners', pick: (r) => r.corners },
  { label: 'Fouls', pick: (r) => r.fouls },
  { label: 'Pass acc%', pick: passAccuracy },
]

/**
 * Pure mapper: upstream team_match_stats rows (one per side) → MatchStats.
 *
 * Identifies the home / away row via `is_home`. Builds the canonical
 * label list in fixed order, skipping any label where BOTH sides are
 * null. Coerces individual null values to 0 for display.
 *
 * `xG` is included only when at least one side has a non-null
 * `expected_goals`; otherwise it is `null`.
 */
export function mapTeamStats(
  rows: FIFATeamMatchStats[],
  // `homeShort` and `awayShort` are accepted for API symmetry with the
  // other section mappers and to allow future labelled returns. They're
  // currently unused — the MatchStats shape carries no team-short fields.
  _homeShort: string,
  _awayShort: string,
): MatchStats {
  const homeRow = rows.find((r) => r.is_home) ?? null
  const awayRow = rows.find((r) => !r.is_home) ?? null

  const labels: string[] = []
  const values: Record<string, [number, number]> = {}

  for (const { label, pick } of CANONICAL_LABELS) {
    const h = homeRow ? pick(homeRow) : null
    const a = awayRow ? pick(awayRow) : null
    if (h == null && a == null) continue
    labels.push(label)
    values[label] = [h ?? 0, a ?? 0]
  }

  let xG: [number, number] | null = null
  const hxg = homeRow?.expected_goals ?? null
  const axg = awayRow?.expected_goals ?? null
  if (hxg != null || axg != null) {
    xG = [hxg ?? 0, axg ?? 0]
  }

  return { labels, values, xG }
}
