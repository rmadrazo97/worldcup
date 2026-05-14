// getStandings — group tables for a season, optionally filtered to a
// single group letter.
//
// Primary path: `/group_standings?seasons[]={season}` paginated, mapped via
// `mapStanding`, filtered to `groupId` if supplied. On TierRequiredError
// (ALL-STAR gated upstream) we fall back to recomputing standings from the
// cached matches list — that's the whole reason `getMatches` fan-outs the
// season list. `tier_required: true` is set on the response so the client
// can flag the fallback as approximate.
//
// Cache keys:
//   `standings/standings_{season}_{groupId}` when filtered
//   `standings/standings_{season}` for the full set
// TTL: `TTL.standings` (10 min). The scheduler keeps it warm on matchdays.

import { onCall } from 'firebase-functions/v2/https'
import { BALLDONTLIE_API_KEY, LIGHT_READ } from '../config.js'
import { APP_CHECK_OPTS } from '../middleware/appCheck.js'
import { withRateLimit } from '../middleware/rateLimit.js'
import { withValidate } from '../middleware/validate.js'
import {
  GetStandingsInput,
  type GetStandingsInputT,
} from '../schemas/inputs.js'
import { paginate } from '../upstream/client.js'
import type { FIFAMatch, FIFAStanding } from '../upstream/types.js'
import { mapStanding, computeStandings } from '../mappers/standings.js'
import { mapMatch } from '../mappers/match.js'
import { getOrSet } from '../cache/firestore.js'
import { matchesListKey, standingsKey } from '../cache/keys.js'
import { TTL } from '../util/ttl.js'
import { TierRequiredError } from '../upstream/errors.js'
import { stripInternal } from '../util/sanitize.js'
import { logHandler } from '../util/logging.js'
import type { ApiList, Match, Standing } from '../internal/types.js'

export const getStandings = onCall(
  { ...LIGHT_READ, ...APP_CHECK_OPTS, secrets: [BALLDONTLIE_API_KEY] },
  withRateLimit(
    withValidate(
      GetStandingsInput,
      async (input: GetStandingsInputT): Promise<ApiList<Standing>> => {
        const started = Date.now()
        const { season, groupId } = input
        try {
          const out = await getOrSet<ApiList<Standing>>(
            'standings',
            standingsKey(season, groupId ?? null),
            TTL.standings,
            async () => {
              try {
                const rows = await paginate<FIFAStanding>(
                  '/group_standings',
                  { 'seasons[]': [season] },
                )
                const mapped = rows.map(mapStanding)
                const filtered = groupId
                  ? mapped.filter((s) => s.groupId === groupId).map(toStanding)
                  : mapped.map(toStanding)
                return { data: filtered }
              } catch (err) {
                if (!(err instanceof TierRequiredError)) throw err
                // Fallback: recompute from cached matches list. We piggy-back
                // on the matches cache rather than fetching directly, so a
                // warmed-up handler is O(1).
                const matchesList = await getOrSet<ApiList<Match>>(
                  'matches',
                  matchesListKey(season),
                  TTL.matchesList,
                  async () => {
                    const rawRows = await paginate<FIFAMatch>('/matches', {
                      'seasons[]': [season],
                    })
                    return { data: rawRows.map(mapMatch) }
                  },
                )
                const allMatches = matchesList.value.data
                const computed: Standing[] = []
                if (groupId) {
                  computed.push(...computeStandings(allMatches, groupId))
                } else {
                  // Union across every group letter that appears in the data.
                  const seenGroups = new Set<string>()
                  for (const m of allMatches) {
                    if (m.group) seenGroups.add(m.group)
                  }
                  const sortedGroups = Array.from(seenGroups).sort()
                  for (const gid of sortedGroups) {
                    computed.push(...computeStandings(allMatches, gid))
                  }
                }
                return { data: computed, tier_required: true }
              }
            },
          )
          logHandler('getStandings', {
            cache_hit: out.cacheHit,
            stale: out.stale,
            frozen: out.frozen,
            tier_required: Boolean(out.value.tier_required),
            upstream_ms: 0,
            total_ms: Date.now() - started,
            status: 'ok',
            season,
            groupId: groupId ?? null,
          })
          return stripInternal(out.value)
        } catch (err) {
          if (err instanceof TierRequiredError) {
            return { data: [], tier_required: true }
          }
          throw err
        }
      },
    ),
  ),
)

// `mapStanding` returns a row tagged with `groupId` (string A..L) so we can
// filter; the public Standing shape drops that field.
function toStanding(s: Standing & { groupId?: string }): Standing {
  const { team, teamId, pld, w, d, l, gf, ga, gd, pts, pos } = s
  return { team, teamId, pld, w, d, l, gf, ga, gd, pts, pos }
}
