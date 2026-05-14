// getTeams — list every team for a given World Cup season.
//
// Cache: `teams/teams_{season}` for 24 h (`TTL.teams`). The fixture set is
// effectively immutable inside a season, so we hit upstream at most once a
// day. `/teams` is free-tier on balldontlie, so TierRequiredError is
// defensive only — we soft-empty if it ever fires.

import { onCall } from 'firebase-functions/v2/https'
import { BALLDONTLIE_API_KEY, LIGHT_READ } from '../config.js'
import { APP_CHECK_OPTS } from '../middleware/appCheck.js'
import { withRateLimit } from '../middleware/rateLimit.js'
import { withValidate } from '../middleware/validate.js'
import { GetTeamsInput, type GetTeamsInputT } from '../schemas/inputs.js'
import { paginate } from '../upstream/client.js'
import type { FIFATeam } from '../upstream/types.js'
import { mapTeam } from '../mappers/team.js'
import { getOrSet } from '../cache/firestore.js'
import { teamsKey } from '../cache/keys.js'
import { TTL } from '../util/ttl.js'
import { TierRequiredError } from '../upstream/errors.js'
import { stripInternal } from '../util/sanitize.js'
import { logHandler } from '../util/logging.js'
import type { ApiList, Team } from '../internal/types.js'

export const getTeams = onCall(
  { ...LIGHT_READ, ...APP_CHECK_OPTS, secrets: [BALLDONTLIE_API_KEY] },
  withRateLimit(
    withValidate(GetTeamsInput, async (input: GetTeamsInputT): Promise<ApiList<Team>> => {
      const started = Date.now()
      try {
        const out = await getOrSet<ApiList<Team>>(
          'teams',
          teamsKey(input.season),
          TTL.teams,
          async () => {
            const rows = await paginate<FIFATeam>('/teams', {
              'seasons[]': [input.season],
            })
            return { data: rows.map(mapTeam) }
          },
        )
        logHandler('getTeams', {
          cache_hit: out.cacheHit,
          stale: out.stale,
          frozen: out.frozen,
          tier_required: false,
          upstream_ms: 0,
          total_ms: Date.now() - started,
          status: 'ok',
          season: input.season,
        })
        return stripInternal(out.value)
      } catch (err) {
        if (err instanceof TierRequiredError) {
          logHandler('getTeams', {
            cache_hit: false,
            stale: false,
            frozen: false,
            tier_required: true,
            upstream_ms: 0,
            total_ms: Date.now() - started,
            status: 'ok',
            season: input.season,
          })
          return { data: [], tier_required: true }
        }
        throw err
      }
    }),
  ),
)
