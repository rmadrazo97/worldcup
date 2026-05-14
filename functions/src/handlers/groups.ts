// getGroups — synthesized; there is no `/groups` endpoint upstream.
//
// We try `/group_standings` first (richest signal: position, points,
// goals_for/against per team-in-group). If that 402s (ALL-STAR-gated) or
// any other tier failure occurs, we fall back to `/matches` and infer the
// group memberships from `match.group.name` + the home/away teams.
//
// Cache: `groups/groups_{season}` for 24 h. If both upstream paths fail
// with tier-required, surface `tier_required: true` with an empty list.

import { onCall } from 'firebase-functions/v2/https'
import { BALLDONTLIE_API_KEY, LIGHT_READ } from '../config.js'
import { APP_CHECK_OPTS } from '../middleware/appCheck.js'
import { withRateLimit } from '../middleware/rateLimit.js'
import { withValidate } from '../middleware/validate.js'
import { GetGroupsInput, type GetGroupsInputT } from '../schemas/inputs.js'
import { paginate } from '../upstream/client.js'
import type { FIFAMatch, FIFAStanding } from '../upstream/types.js'
import { mapMatch } from '../mappers/match.js'
import { mapStanding } from '../mappers/standings.js'
import {
  synthesizeGroupsFromStandings,
  synthesizeGroupsFromMatches,
} from '../mappers/group.js'
import { getOrSet } from '../cache/firestore.js'
import { groupsKey } from '../cache/keys.js'
import { TTL } from '../util/ttl.js'
import { TierRequiredError, UpstreamBadRequest } from '../upstream/errors.js'
import { stripInternal } from '../util/sanitize.js'
import { logHandler } from '../util/logging.js'
import type { ApiList, Group } from '../internal/types.js'

export const getGroups = onCall(
  { ...LIGHT_READ, ...APP_CHECK_OPTS, secrets: [BALLDONTLIE_API_KEY] },
  withRateLimit(
    withValidate(
      GetGroupsInput,
      async (input: GetGroupsInputT): Promise<ApiList<Group>> => {
        const started = Date.now()
        try {
          const out = await getOrSet<ApiList<Group>>(
            'groups',
            groupsKey(input.season),
            TTL.groups,
            async () => {
              try {
                const rows = await paginate<FIFAStanding>('/group_standings', {
                  'seasons[]': [input.season],
                })
                const groups = synthesizeGroupsFromStandings(rows.map(mapStanding))
                return { data: groups }
              } catch (err) {
                // Fall back to /matches on tier-gating OR a non-auth 4xx
                // (some seasons may not have a group_standings entry).
                const isFallbackTrigger =
                  err instanceof TierRequiredError ||
                  (err instanceof UpstreamBadRequest && err.status !== 401)
                if (!isFallbackTrigger) throw err
                const matchRows = await paginate<FIFAMatch>('/matches', {
                  'seasons[]': [input.season],
                })
                const groups = synthesizeGroupsFromMatches(matchRows.map(mapMatch))
                return { data: groups }
              }
            },
          )
          logHandler('getGroups', {
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
