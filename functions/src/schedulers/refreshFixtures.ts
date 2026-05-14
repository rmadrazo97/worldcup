// refreshFixtures — daily 04:00 UTC. Re-pulls every season's full match
// list, mapping and writing through to `matches/list_{season}` plus the
// per-match fan-out at `matches/match_{id}`.
//
// Idempotent: each writeThrough is a `set()`-by-doc-id. A failure on one
// season doesn't stop the others; we log and continue.

import { onSchedule } from 'firebase-functions/v2/scheduler'
import { BALLDONTLIE_API_KEY, SCHEDULER } from '../config.js'
import { paginate } from '../upstream/client.js'
import type { FIFAMatch } from '../upstream/types.js'
import { mapMatch } from '../mappers/match.js'
import { writeThrough } from '../cache/firestore.js'
import { matchKey, matchesListKey } from '../cache/keys.js'
import { TTL, ttlForMatch } from '../util/ttl.js'
import { logger } from '../util/logging.js'
import type { ApiList, Match, Season } from '../internal/types.js'

const SEASONS: readonly Season[] = [2018, 2022, 2026]

export const refreshFixtures = onSchedule(
  {
    schedule: '0 4 * * *',
    timeZone: 'UTC',
    secrets: [BALLDONTLIE_API_KEY],
    ...SCHEDULER,
  },
  async () => {
    const startedAt = Date.now()
    logger.info('refreshFixtures.start')

    for (const season of SEASONS) {
      try {
        const rows = await paginate<FIFAMatch>('/matches', {
          'seasons[]': [season],
        })
        const mapped = rows
          .map(mapMatch)
          .sort((a, b) => a.kickoff_iso.localeCompare(b.kickoff_iso))

        await writeThrough<ApiList<Match>>(
          'matches',
          matchesListKey(season),
          TTL.matchesList,
          { data: mapped },
          'scheduler',
        )

        await Promise.allSettled(
          mapped.map((m) =>
            writeThrough(
              'matches',
              matchKey(m.id),
              ttlForMatch(m.status),
              m,
              'scheduler',
            ),
          ),
        )

        logger.info('refreshFixtures.season_ok', {
          season,
          count: mapped.length,
        })
      } catch (err) {
        logger.error('refreshFixtures.season_failed', {
          season,
          err: String(err),
        })
      }
    }

    logger.info('refreshFixtures.done', { ms: Date.now() - startedAt })
  },
)
