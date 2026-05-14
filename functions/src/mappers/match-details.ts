// Composer: glue per-section mappers into a MatchDetails composite.
// Mirrors docs/plan/02-data-contracts.md § 9.
//
// Pure: no I/O, no Promises. The handler awaits upstream data and then
// passes the arrays here for assembly.

import type {
  FIFAMatchEvent,
  FIFAMatchLineupRow,
  FIFATeamMatchStats,
} from '../upstream/types.js'
import type {
  Lineup,
  Match,
  MatchDetails,
  MatchEvent,
} from '../internal/types.js'
import { mapEvent } from './event.js'
import { mapLineup } from './lineup.js'
import { mapTeamStats } from './team-stats.js'

export interface ComposeMatchDetailsArgs {
  matchId: string
  match: Match
  lineupRows?: FIFAMatchLineupRow[]
  events?: FIFAMatchEvent[]
  teamStatsRows?: FIFATeamMatchStats[]
  tier_required?: {
    lineups?: boolean
    events?: boolean
    stats?: boolean
  }
}

/**
 * Compose a MatchDetails composite from the per-section upstream arrays.
 *
 * Any section whose input array is `undefined` OR is flagged in
 * `tier_required` is returned as `null` (lineups) / `[]` (events) /
 * `null` (stats) and the `tier_required` flag is propagated onto the
 * returned MatchDetails.
 */
export function composeMatchDetails(
  args: ComposeMatchDetailsArgs,
): MatchDetails {
  const tier = args.tier_required ?? {}

  // --- Lineups ---------------------------------------------------------
  let homeLineup: Lineup | null = null
  let awayLineup: Lineup | null = null
  if (args.lineupRows && !tier.lineups) {
    homeLineup = mapLineup(args.lineupRows, args.match.homeId, args.match.home)
    awayLineup = mapLineup(args.lineupRows, args.match.awayId, args.match.away)
  }

  // --- Events ----------------------------------------------------------
  let events: MatchEvent[] = []
  if (args.events && !tier.events) {
    const ctx = { homeShort: args.match.home, awayShort: args.match.away }
    events = args.events
      .map((e) => mapEvent(e, ctx))
      .filter((e): e is MatchEvent => e !== null)
  }

  // --- Team stats ------------------------------------------------------
  let stats: MatchDetails['stats'] = null
  if (args.teamStatsRows && !tier.stats) {
    stats = mapTeamStats(
      args.teamStatsRows,
      args.match.home,
      args.match.away,
    )
  }

  // --- tier_required propagation --------------------------------------
  const reqOut: NonNullable<MatchDetails['tier_required']> = {}
  if (tier.lineups || args.lineupRows == null) {
    if (tier.lineups) reqOut.lineups = true
  }
  if (tier.events || args.events == null) {
    if (tier.events) reqOut.events = true
  }
  if (tier.stats || args.teamStatsRows == null) {
    if (tier.stats) reqOut.stats = true
  }

  const details: MatchDetails = {
    matchId: args.matchId,
    lineups: { home: homeLineup, away: awayLineup },
    events,
    stats,
    attendance: args.match.attendance,
  }
  if (Object.keys(reqOut).length > 0) details.tier_required = reqOut
  return details
}
