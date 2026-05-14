// Single source of truth for cache TTLs (seconds).
// Mirrors docs/plan/01-architecture.md § 6 and 03-backend-functions.md § 5.4.

export type MatchStatus = 'SCHED' | 'LIVE' | 'HT' | 'FT' | 'PP' | 'CXL'

const HOUR = 60 * 60
const DAY = 24 * HOUR

export const TTL = {
  teams: 24 * HOUR,
  stadiums: 24 * HOUR,
  groups: 24 * HOUR,
  standings_pre: 60 * 60,
  standings_live: 30,
  standings_post: 24 * HOUR,
  standings: 10 * 60,
  matchesList: 5 * 60,
  matchesList_live: 30,
  matchById_scheduled: 5 * 60,
  matchById_live: 15,
  matchById_finished: 24 * HOUR,
  matchDetails_live: 30,
  matchDetails_finished: 24 * HOUR,
  lineups: HOUR,
  events_live: 30,
  events_finished: 24 * HOUR,
  teamStats_live: 30,
  teamStats_finished: 24 * HOUR,
  players: HOUR,
  rosters: HOUR,
  odds: 5 * 60,
} as const

export function ttlForMatch(status: MatchStatus): number {
  if (status === 'LIVE' || status === 'HT') return TTL.matchById_live
  if (status === 'FT') return TTL.matchById_finished
  return TTL.matchById_scheduled
}

export function ttlForMatchDetails(status: MatchStatus): number {
  if (status === 'LIVE' || status === 'HT') return TTL.matchDetails_live
  if (status === 'FT') return TTL.matchDetails_finished
  return TTL.matchDetails_live
}

// Year-9999 epoch ms — used as _expiresAt on frozen docs so Firestore's
// native TTL policy never evicts them.
export const FROZEN_EXPIRES_AT_MS = Date.UTC(9999, 11, 31, 23, 59, 59)
