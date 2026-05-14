// Pure mappers: synthesise Group[] from either standings or matches.
// Mirrors docs/plan/02-data-contracts.md § 2.2 (Group shape, host rule).

import type { Group, Match, Season } from '../internal/types.js'
import type { StandingWithMeta } from './standings.js'

/**
 * Host group → host display name, per FIFA assignment.
 *
 * - 2018 (Russia, single host): Group A → "Russia".
 * - 2022 (Qatar, single host): Group A → "Qatar".
 * - 2026 (Mexico/Canada/USA, three co-hosts): A → "Mexico",
 *   B → "Canada", D → "United States" per the official draw.
 */
const HOSTS_BY_SEASON: Record<number, Record<string, string>> = {
  2018: { A: 'Russia' },
  2022: { A: 'Qatar' },
  2026: { A: 'Mexico', B: 'Canada', D: 'United States' },
}

function hostFor(season: number | undefined, groupId: string): string | null {
  if (season == null) return null
  const table = HOSTS_BY_SEASON[season]
  if (!table) return null
  return table[groupId] ?? null
}

/**
 * Synthesise Group[] from a mapped standings list.
 *
 * Groups by `groupId`, collects distinct team shorts ordered by
 * upstream `pos` so the canonical group ordering is deterministic
 * (top of the group first). Assumes every standing in the input
 * comes from the same season.
 */
export function synthesizeGroupsFromStandings(
  standings: StandingWithMeta[],
): Group[] {
  const byGroup = new Map<string, StandingWithMeta[]>()
  for (const s of standings) {
    const list = byGroup.get(s.groupId) ?? []
    list.push(s)
    byGroup.set(s.groupId, list)
  }
  const season = standings[0]?.season
  const groups: Group[] = []
  for (const [groupId, rows] of byGroup.entries()) {
    rows.sort((a, b) => a.pos - b.pos)
    const teams = Array.from(new Set(rows.map((r) => r.teamShort)))
    groups.push({ id: groupId, teams, host: hostFor(season, groupId) })
  }
  groups.sort((a, b) => a.id.localeCompare(b.id))
  return groups
}

/**
 * Synthesise Group[] from a mapped match list.
 *
 * Collects every team that appears in a group-stage match, buckets
 * them by `group` letter, dedupes preserving first-seen order
 * (which corresponds to kickoff order if the input is sorted).
 */
export function synthesizeGroupsFromMatches(matches: Match[]): Group[] {
  const byGroup = new Map<string, string[]>()
  let season: Season | undefined
  for (const m of matches) {
    if (m.stage !== 'group' || m.group == null) continue
    season = m.season
    const list = byGroup.get(m.group) ?? []
    if (!list.includes(m.home)) list.push(m.home)
    if (!list.includes(m.away)) list.push(m.away)
    byGroup.set(m.group, list)
  }
  const groups: Group[] = []
  for (const [groupId, teams] of byGroup.entries()) {
    groups.push({ id: groupId, teams, host: hostFor(season, groupId) })
  }
  groups.sort((a, b) => a.id.localeCompare(b.id))
  return groups
}
