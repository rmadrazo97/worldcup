// getLineup — returns a single team's lineup (home or away) for one match.
//
// Fast path: if the `matchDetails/details_{id}` cache is warm, pull the
// already-composed lineups pair out of it and pick the requested side. No
// upstream call.
//
// Slow path: fetch /match_lineups + the canonical match doc, then run
// mapLineup once per side to produce a { home, away } pair that we cache
// at `lineups/lineups_{matchId}` for 1 h. The next request — even for the
// other side — is a cache hit.

import { onCall } from 'firebase-functions/v2/https'
import { BALLDONTLIE_API_KEY, LIGHT_READ } from '../config.js'
import { APP_CHECK_OPTS } from '../middleware/appCheck.js'
import { withRateLimit } from '../middleware/rateLimit.js'
import { withValidate } from '../middleware/validate.js'
import { GetLineupInput, type GetLineupInputT } from '../schemas/inputs.js'
import { paginate, request } from '../upstream/client.js'
import type {
  FIFAList,
  FIFAMatch,
  FIFAMatchLineupRow,
} from '../upstream/types.js'
import { mapLineup } from '../mappers/lineup.js'
import { mapMatch } from '../mappers/match.js'
import { getOrSet } from '../cache/firestore.js'
import { lineupsKey, matchDetailsKey, matchKey } from '../cache/keys.js'
import { TTL } from '../util/ttl.js'
import { db } from '../firebase.js'
import { TierRequiredError } from '../upstream/errors.js'
import { stripInternal } from '../util/sanitize.js'
import { logHandler } from '../util/logging.js'
import type { CachedDoc } from '../cache/types.js'
import type {
  ApiSingle,
  Lineup,
  Match,
  MatchDetails,
} from '../internal/types.js'

interface LineupPair {
  home: Lineup | null
  away: Lineup | null
}

export const getLineup = onCall(
  { ...LIGHT_READ, ...APP_CHECK_OPTS, secrets: [BALLDONTLIE_API_KEY] },
  withRateLimit(
    withValidate(
      GetLineupInput,
      async (input: GetLineupInputT): Promise<ApiSingle<Lineup>> => {
        const started = Date.now()
        const { matchId, team } = input
        try {
          // Fast path: the matchDetails cache already carries lineups.
          const cached = await tryReadMatchDetails(matchId)
          if (cached && cached.lineups) {
            const side = team === 'home' ? cached.lineups.home : cached.lineups.away
            logHandler('getLineup', {
              cache_hit: true,
              stale: false,
              frozen: false,
              tier_required: Boolean(cached.tier_required?.lineups),
              upstream_ms: 0,
              total_ms: Date.now() - started,
              status: 'ok',
              matchId,
              team,
              source: 'matchDetails',
            })
            return stripInternal({ data: side ?? null })
          }

          const out = await getOrSet<LineupPair>(
            'lineups',
            lineupsKey(matchId),
            TTL.lineups,
            async () => {
              const match = await loadMatch(matchId)
              if (!match) return { home: null, away: null }
              const rows = await paginate<FIFAMatchLineupRow>(
                '/match_lineups',
                { 'match_ids[]': [matchId] },
              )
              return {
                home: mapLineup(rows, match.homeId, match.home),
                away: mapLineup(rows, match.awayId, match.away),
              }
            },
          )
          const side = team === 'home' ? out.value.home : out.value.away
          logHandler('getLineup', {
            cache_hit: out.cacheHit,
            stale: out.stale,
            frozen: out.frozen,
            tier_required: false,
            upstream_ms: 0,
            total_ms: Date.now() - started,
            status: 'ok',
            matchId,
            team,
            source: 'lineups',
          })
          return stripInternal({ data: side ?? null })
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

async function tryReadMatchDetails(matchId: string): Promise<MatchDetails | null> {
  const ref = db.collection('matchDetails').doc(matchDetailsKey(matchId))
  const snap = await ref.get()
  if (!snap.exists) return null
  const doc = snap.data() as CachedDoc<MatchDetails> | undefined
  if (!doc) return null
  if (doc._frozen === true) return doc.payload
  const expiresAt = doc._expiresAt?.toMillis?.() ?? 0
  if (expiresAt > Date.now()) return doc.payload
  return null
}

// Resolves the canonical match — first via the cache, then via a single
// upstream call. Returns null if the match doesn't exist upstream either.
async function loadMatch(matchId: string): Promise<Match | null> {
  const ref = db.collection('matches').doc(matchKey(matchId))
  const snap = await ref.get()
  if (snap.exists) {
    const doc = snap.data() as CachedDoc<Match> | undefined
    if (doc) {
      const expiresAt = doc._expiresAt?.toMillis?.() ?? 0
      if (doc._frozen === true || expiresAt > Date.now()) return doc.payload
    }
  }
  const page = await request<FIFAList<FIFAMatch>>('/matches', {
    'match_ids[]': [matchId],
  })
  const row = page.data[0]
  if (!row) return null
  return mapMatch(row)
}
