// getStadiums — list every venue used in a given World Cup season.
//
// Cache: `stadiums/stadiums_{season}` for 24 h. Same skeleton as
// `getTeams`; free-tier endpoint, soft-empties on tier-required just in
// case.

import { onCall } from 'firebase-functions/v2/https'
import { BALLDONTLIE_API_KEY, LIGHT_READ } from '../config.js'
import { APP_CHECK_OPTS } from '../middleware/appCheck.js'
import { withRateLimit } from '../middleware/rateLimit.js'
import { withValidate } from '../middleware/validate.js'
import { GetStadiumsInput, type GetStadiumsInputT } from '../schemas/inputs.js'
import { paginate } from '../upstream/client.js'
import type { FIFAStadium } from '../upstream/types.js'
import { mapStadium } from '../mappers/stadium.js'
import { getOrSet } from '../cache/firestore.js'
import { stadiumsKey } from '../cache/keys.js'
import { TTL } from '../util/ttl.js'
import { TierRequiredError } from '../upstream/errors.js'
import { stripInternal } from '../util/sanitize.js'
import { logHandler } from '../util/logging.js'
import type { ApiList, Venue } from '../internal/types.js'

export const getStadiums = onCall(
  { ...LIGHT_READ, ...APP_CHECK_OPTS, secrets: [BALLDONTLIE_API_KEY] },
  withRateLimit(
    withValidate(
      GetStadiumsInput,
      async (input: GetStadiumsInputT): Promise<ApiList<Venue>> => {
        const started = Date.now()
        try {
          const out = await getOrSet<ApiList<Venue>>(
            'stadiums',
            stadiumsKey(input.season),
            TTL.stadiums,
            async () => {
              const rows = await paginate<FIFAStadium>('/stadiums', {
                'seasons[]': [input.season],
              })
              return { data: rows.map(mapStadium) }
            },
          )
          logHandler('getStadiums', {
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
            return { data: [], tier_required: true }
          }
          throw err
        }
      },
    ),
  ),
)
