// Pure cache-key builders. Lowercase, underscore-separated, season-prefixed.
// Pure functions only — no I/O, no imports from firestore. Tested via
// equality on stable strings.

export function teamsKey(season: number): string {
  return `teams_${season}`
}

export function stadiumsKey(season: number): string {
  return `stadiums_${season}`
}

export function groupsKey(season: number): string {
  return `groups_${season}`
}

export function standingsKey(season: number, groupId?: string | null): string {
  return groupId ? `standings_${season}_${groupId}` : `standings_${season}`
}

export interface MatchesListFilters {
  status?: string | null
  group?: string | null
  date?: string | null
}

/**
 * Deterministic key for a filtered match list. Filter parts that are
 * unset collapse to `all`, so callers that pass `{}` and callers that
 * pass `{status: null}` share a cache slot.
 */
export function matchesListKey(season: number, filters?: MatchesListFilters): string {
  const status = filters?.status ?? 'all'
  const group = filters?.group ?? 'all'
  const date = filters?.date ?? 'all'
  return `matches_${season}_${status}_${group}_${date}`.toLowerCase()
}

export function matchKey(matchId: string | number): string {
  return `match_${matchId}`
}

export function matchDetailsKey(matchId: string | number): string {
  return `details_${matchId}`
}

export function lineupsKey(matchId: string | number): string {
  return `lineups_${matchId}`
}
