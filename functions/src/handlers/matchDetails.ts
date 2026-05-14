// getMatchDetails — composite handler that fans out to lineups, events,
// team_match_stats in parallel and returns one unified MatchDetails blob.
//
// Flow:
//   1. Read the canonical `matches/match_{id}` doc (writeThrough'd by
//      `getMatches`/`getMatchById` or `refreshFixtures`); if missing, fetch
//      via `request('/matches', { 'match_ids[]': [id] })`.
//   2. Promise.allSettled the three sub-section fetches. Each section that
//      rejects with TierRequiredError flips the matching key in
//      `tier_required`; other errors propagate (we never silently swallow
//      a 500 — let HttpsError surface).
//   3. Compose via `composeMatchDetails` and write through to
//      `matchDetails/details_{id}` with `ttlForMatchDetails(status)`.

import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { BALLDONTLIE_API_KEY, COMPOSITE } from '../config.js'
import { APP_CHECK_OPTS } from '../middleware/appCheck.js'
import { withRateLimit } from '../middleware/rateLimit.js'
import { withValidate } from '../middleware/validate.js'
import {
  GetMatchDetailsInput,
  type GetMatchDetailsInputT,
} from '../schemas/inputs.js'
import { paginate, request } from '../upstream/client.js'
import type {
  FIFAList,
  FIFAMatch,
  FIFAMatchEvent,
  FIFAMatchLineupRow,
  FIFATeamMatchStats,
} from '../upstream/types.js'
import { mapMatch } from '../mappers/match.js'
import { composeMatchDetails } from '../mappers/match-details.js'
import { getOrSet, writeThrough } from '../cache/firestore.js'
import { matchDetailsKey, matchKey } from '../cache/keys.js'
import { ttlForMatchDetails } from '../util/ttl.js'
import { db } from '../firebase.js'
import { TierRequiredError } from '../upstream/errors.js'
import { stripInternal } from '../util/sanitize.js'
import { logHandler } from '../util/logging.js'
import type { CachedDoc } from '../cache/types.js'
import type {
  ApiSingle,
  Match,
  MatchDetails,
} from '../internal/types.js'

export const getMatchDetails = onCall(
  { ...COMPOSITE, ...APP_CHECK_OPTS, secrets: [BALLDONTLIE_API_KEY] },
  withRateLimit(
    withValidate(
      GetMatchDetailsInput,
      async (input: GetMatchDetailsInputT): Promise<ApiSingle<MatchDetails>> => {
        const started = Date.now()
        const { matchId } = input

        const match = await getOrFetchMatch(matchId)
        if (!match) throw new HttpsError('not-found', `match ${matchId}`)

        const ttl = ttlForMatchDetails(match.status)
        const tierRequired: { lineups?: boolean; events?: boolean; stats?: boolean } = {}

        const out = await getOrSet<MatchDetails>(
          'matchDetails',
          matchDetailsKey(matchId),
          ttl,
          async () => {
            const [lineupsRes, eventsRes, statsRes] = await Promise.allSettled([
              paginate<FIFAMatchLineupRow>('/match_lineups', {
                'match_ids[]': [matchId],
              }),
              paginate<FIFAMatchEvent>('/match_events', {
                'match_ids[]': [matchId],
              }),
              paginate<FIFATeamMatchStats>('/team_match_stats', {
                'match_ids[]': [matchId],
              }),
            ])

            const lineupRows = unwrap('lineups', lineupsRes, tierRequired)
            const events = unwrap('events', eventsRes, tierRequired)
            const teamStatsRows = unwrap('stats', statsRes, tierRequired)

            return composeMatchDetails({
              matchId,
              match,
              lineupRows: lineupRows ?? [],
              events: events ?? [],
              teamStatsRows: teamStatsRows ?? [],
              tier_required: Object.keys(tierRequired).length ? tierRequired : undefined,
            })
          },
        )

        logHandler('getMatchDetails', {
          cache_hit: out.cacheHit,
          stale: out.stale,
          frozen: out.frozen,
          tier_required: Boolean(out.value.tier_required),
          upstream_ms: 0,
          total_ms: Date.now() - started,
          status: 'ok',
          matchId,
        })
        return stripInternal({ data: out.value })
      },
    ),
  ),
)

// Pull from cache first, fall back to a single-match upstream request.
async function getOrFetchMatch(matchId: string): Promise<Match | null> {
  const ref = db.collection('matches').doc(matchKey(matchId))
  const snap = await ref.get()
  if (snap.exists) {
    const doc = snap.data() as CachedDoc<Match | null> | undefined
    if (doc) {
      const expiresAt = doc._expiresAt?.toMillis?.() ?? 0
      if (doc._frozen === true || expiresAt > Date.now()) {
        return doc.payload
      }
    }
  }
  try {
    const page = await request<FIFAList<FIFAMatch>>('/matches', {
      'match_ids[]': [matchId],
    })
    const row = page.data[0]
    if (!row) return null
    const m = mapMatch(row)
    await writeThrough('matches', matchKey(matchId), 5 * 60, m)
    return m
  } catch (err) {
    if (err instanceof TierRequiredError) return null
    throw err
  }
}

function unwrap<T>(
  section: 'lineups' | 'events' | 'stats',
  res: PromiseSettledResult<T>,
  tierRequired: { lineups?: boolean; events?: boolean; stats?: boolean },
): T | null {
  if (res.status === 'fulfilled') return res.value
  if (res.reason instanceof TierRequiredError) {
    tierRequired[section] = true
    return null
  }
  throw res.reason
}
