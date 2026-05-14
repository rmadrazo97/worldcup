// getMatches + getMatchById.
//
// `getMatches` caches the FULL season list ONCE at `matches/list_{season}`
// and filters in memory. This intentionally collapses cache-key
// combinations: 64 matches × N filters would explode the cache; one season
// blob plus client-side slicing is cheaper and warmer. After a cache miss
// the list also fans out into per-match docs (`matches/match_{id}`), so a
// subsequent `getMatchById` hits the cache.
//
// `getMatchById` is the single-match callable; its cache lives at
// `matches/match_{id}` with `ttlForMatch(status)` (15 s LIVE, 24 h FT,
// 5 min SCHED).

import { onCall } from 'firebase-functions/v2/https'
import { BALLDONTLIE_API_KEY, LIGHT_READ } from '../config.js'
import { APP_CHECK_OPTS } from '../middleware/appCheck.js'
import { withRateLimit } from '../middleware/rateLimit.js'
import { withValidate } from '../middleware/validate.js'
import {
  GetMatchByIdInput,
  GetMatchesInput,
  type GetMatchByIdInputT,
  type GetMatchesInputT,
} from '../schemas/inputs.js'
import { paginate, request } from '../upstream/client.js'
import type { FIFAList, FIFAMatch } from '../upstream/types.js'
import { mapMatch } from '../mappers/match.js'
import { getOrSet, writeThrough } from '../cache/firestore.js'
import { matchKey, matchesListKey } from '../cache/keys.js'
import { TTL, ttlForMatch } from '../util/ttl.js'
import { TierRequiredError } from '../upstream/errors.js'
import { stripInternal } from '../util/sanitize.js'
import { logHandler } from '../util/logging.js'
import type { ApiList, ApiSingle, Match, MatchStatus } from '../internal/types.js'

// Helper extracted so refreshLiveMatches / refreshFixtures stay in sync.
function listTtlFor(matches: ReadonlyArray<Pick<Match, 'status'>>): number {
  return matches.some((m) => m.status === 'LIVE' || m.status === 'HT')
    ? TTL.matchesList_live
    : TTL.matchesList
}

export const getMatches = onCall(
  { ...LIGHT_READ, ...APP_CHECK_OPTS, secrets: [BALLDONTLIE_API_KEY] },
  withRateLimit(
    withValidate(
      GetMatchesInput,
      async (input: GetMatchesInputT): Promise<ApiList<Match>> => {
        const started = Date.now()
        const { season, status, group, date } = input
        try {
          // Always cache the unfiltered list to avoid cache-key explosion.
          const out = await getOrSet<ApiList<Match>>(
            'matches',
            matchesListKey(season),
            TTL.matchesList,
            async () => {
              const rows = await paginate<FIFAMatch>('/matches', {
                'seasons[]': [season],
              })
              const mapped = rows
                .map(mapMatch)
                .sort((a, b) => a.kickoff_iso.localeCompare(b.kickoff_iso))
              // Fan out each match so `getMatchById` is warm. Errors here are
              // non-fatal: the data is already in the list cache.
              await Promise.allSettled(
                mapped.map((m) =>
                  writeThrough(
                    'matches',
                    matchKey(m.id),
                    ttlForMatch(m.status),
                    m,
                  ),
                ),
              )
              // If anything is live, bump the list TTL down via writeThrough
              // (getOrSet's TTL is fixed at call time; overwrite below).
              const ttlOverride = listTtlFor(mapped)
              if (ttlOverride !== TTL.matchesList) {
                await writeThrough<ApiList<Match>>(
                  'matches',
                  matchesListKey(season),
                  ttlOverride,
                  { data: mapped },
                )
              }
              return { data: mapped }
            },
          )

          const filtered = filterMatches(out.value.data, { status, group, date })
          logHandler('getMatches', {
            cache_hit: out.cacheHit,
            stale: out.stale,
            frozen: out.frozen,
            tier_required: false,
            upstream_ms: 0,
            total_ms: Date.now() - started,
            status: 'ok',
            season,
            count: filtered.length,
          })
          return stripInternal({ data: filtered })
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

export const getMatchById = onCall(
  { ...LIGHT_READ, ...APP_CHECK_OPTS, secrets: [BALLDONTLIE_API_KEY] },
  withRateLimit(
    withValidate(
      GetMatchByIdInput,
      async (input: GetMatchByIdInputT): Promise<ApiSingle<Match>> => {
        const started = Date.now()
        const { matchId } = input
        try {
          // We can't pick TTL until we know status; use SCHED as a floor on
          // first miss and upgrade with writeThrough below.
          const out = await getOrSet<Match | null>(
            'matches',
            matchKey(matchId),
            TTL.matchById_scheduled,
            async () => {
              const page = await request<FIFAList<FIFAMatch>>('/matches', {
                'match_ids[]': [matchId],
              })
              const row = page.data[0]
              if (!row) return null
              return mapMatch(row)
            },
          )
          const value = out.value
          if (value && !out.cacheHit) {
            await writeThrough(
              'matches',
              matchKey(matchId),
              ttlForMatch(value.status),
              value,
            )
          }
          logHandler('getMatchById', {
            cache_hit: out.cacheHit,
            stale: out.stale,
            frozen: out.frozen,
            tier_required: false,
            upstream_ms: 0,
            total_ms: Date.now() - started,
            status: 'ok',
            matchId,
          })
          return stripInternal({ data: value })
        } catch (err) {
          if (err instanceof TierRequiredError) {
            return { data: null, tier_required: true }
          }
          throw err
        }
      },
    ),
  ),
)

function filterMatches(
  list: ReadonlyArray<Match>,
  f: { status?: MatchStatus; group?: string; date?: string },
): Match[] {
  return list.filter((m) => {
    if (f.status && m.status !== f.status) return false
    if (f.group && m.group !== f.group) return false
    if (f.date && !m.kickoff_iso.startsWith(f.date)) return false
    return true
  })
}
