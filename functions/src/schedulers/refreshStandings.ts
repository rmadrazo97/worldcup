// refreshStandings — every 10 minutes, current season only.
//
// Self-skips on off-days: we read the cached match list and if no kickoff
// is within today's UTC window (or the next 4 h, per `isMatchdayToday`),
// we return early. This keeps upstream call volume near zero outside the
// tournament.

import { onSchedule } from 'firebase-functions/v2/scheduler'
import { BALLDONTLIE_API_KEY, SCHEDULER } from '../config.js'
import { db } from '../firebase.js'
import { paginate } from '../upstream/client.js'
import type { FIFAMatch, FIFAStanding } from '../upstream/types.js'
import { mapStanding, type StandingWithMeta } from '../mappers/standings.js'
import { writeThrough } from '../cache/firestore.js'
import { matchesListKey, standingsKey } from '../cache/keys.js'
import { TTL } from '../util/ttl.js'
import { isMatchdayToday } from '../util/time.js'
import { TierRequiredError } from '../upstream/errors.js'
import { logger } from '../util/logging.js'
import type { CachedDoc } from '../cache/types.js'
import type { ApiList, Match, Standing } from '../internal/types.js'

const CURRENT_SEASON = 2026

export const refreshStandings = onSchedule(
  {
    schedule: '*/10 * * * *',
    timeZone: 'UTC',
    secrets: [BALLDONTLIE_API_KEY],
    ...SCHEDULER,
  },
  async () => {
    const startedAt = Date.now()
    logger.info('refreshStandings.start')

    // Pull the cached match list, mostly to learn today's kickoffs.
    const ref = db.collection('matches').doc(matchesListKey(CURRENT_SEASON))
    const snap = await ref.get()
    const fakeFifa: Array<{ datetime: string; season: { year: number; id: number } }> = []
    if (snap.exists) {
      const doc = snap.data() as CachedDoc<ApiList<Match>> | undefined
      const list = doc?.payload?.data ?? []
      for (const m of list) {
        fakeFifa.push({
          datetime: m.kickoff_iso,
          season: { year: m.season, id: 0 },
        })
      }
    }
    if (!isMatchdayToday(fakeFifa as never, CURRENT_SEASON)) {
      logger.info('refreshStandings.skipped', { reason: 'no_matches_today' })
      return
    }

    try {
      const rows = await paginate<FIFAStanding>('/group_standings', {
        'seasons[]': [CURRENT_SEASON],
      })
      const mapped: StandingWithMeta[] = rows.map(mapStanding)

      // Overall (no groupId filter).
      await writeThrough<ApiList<Standing>>(
        'standings',
        standingsKey(CURRENT_SEASON, null),
        TTL.standings,
        { data: mapped.map(stripGroupId) },
        'scheduler',
      )

      // Per-group.
      const byGroup = new Map<string, StandingWithMeta[]>()
      for (const s of mapped) {
        if (!s.groupId) continue
        const arr = byGroup.get(s.groupId) ?? []
        arr.push(s)
        byGroup.set(s.groupId, arr)
      }
      await Promise.allSettled(
        Array.from(byGroup.entries()).map(([gid, list]) =>
          writeThrough<ApiList<Standing>>(
            'standings',
            standingsKey(CURRENT_SEASON, gid),
            TTL.standings,
            { data: list.map(stripGroupId) },
            'scheduler',
          ),
        ),
      )

      logger.info('refreshStandings.done', {
        rows: mapped.length,
        groups: byGroup.size,
        ms: Date.now() - startedAt,
      })
    } catch (err) {
      if (err instanceof TierRequiredError) {
        logger.warn('refreshStandings.tier_required')
        return
      }
      logger.error('refreshStandings.failed', { err: String(err) })
    }
  },
)

function stripGroupId(s: StandingWithMeta): Standing {
  const { team, teamId, pld, w, d, l, gf, ga, gd, pts, pos } = s
  return { team, teamId, pld, w, d, l, gf, ga, gd, pts, pos }
}
