// refreshLiveMatches — every 1 min cron baseline; throttles down to a
// 5-minute-spaced "is anything live?" check when no matches are in
// progress, and bumps to every-tick refresh when at least one match goes
// LIVE.
//
// State is persisted in `meta/scheduler_state`:
//   { live_window_active: boolean, next_run_at: Timestamp }
//
// On a no-live tick we set `next_run_at = now + 5m` and short-circuit the
// next four cron firings. On a live tick we refresh every LIVE match doc:
// re-pull the match itself plus events + team_stats, and writeThrough each
// section so the client picks up the new data within the 30 s details TTL.

import { onSchedule } from 'firebase-functions/v2/scheduler'
import { Timestamp } from 'firebase-admin/firestore'
import { BALLDONTLIE_API_KEY, SCHEDULER } from '../config.js'
import { db } from '../firebase.js'
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
import { writeThrough } from '../cache/firestore.js'
import { matchDetailsKey, matchKey } from '../cache/keys.js'
import { ttlForMatch, ttlForMatchDetails, TTL } from '../util/ttl.js'
import {
  TierRequiredError,
  UpstreamServerError,
} from '../upstream/errors.js'
import { logger } from '../util/logging.js'
import type { Match } from '../internal/types.js'

const CURRENT_SEASON = 2026
const IDLE_WINDOW_MS = 5 * 60 * 1000

interface SchedulerState {
  live_window_active?: boolean
  next_run_at?: Timestamp
}

export const refreshLiveMatches = onSchedule(
  {
    schedule: '*/1 * * * *',
    timeZone: 'UTC',
    secrets: [BALLDONTLIE_API_KEY],
    ...SCHEDULER,
  },
  async () => {
    const startedAt = Date.now()
    const stateRef = db.collection('meta').doc('scheduler_state')
    const stateSnap = await stateRef.get()
    const state = (stateSnap.exists ? stateSnap.data() : {}) as SchedulerState

    // Honor the back-off window: if we previously found nothing live and
    // we're inside the 5-min skip, return early without an upstream call.
    if (
      state.live_window_active !== true &&
      state.next_run_at &&
      state.next_run_at.toMillis() > startedAt
    ) {
      return
    }

    logger.info('refreshLiveMatches.start')

    let live: Match[] = []
    try {
      // Cheap probe — upstream `status=in_progress` only returns active rows.
      const probe = await paginate<FIFAMatch>('/matches', {
        'seasons[]': [CURRENT_SEASON],
        status: 'in_progress',
      })
      live = probe.map(mapMatch)
    } catch (err) {
      if (err instanceof UpstreamServerError) {
        logger.warn('refreshLiveMatches.upstream_5xx', { err: String(err) })
        return
      }
      throw err
    }

    if (live.length === 0) {
      await stateRef.set(
        {
          live_window_active: false,
          next_run_at: Timestamp.fromMillis(startedAt + IDLE_WINDOW_MS),
        },
        { merge: true },
      )
      logger.info('refreshLiveMatches.idle', { ms: Date.now() - startedAt })
      return
    }

    // Refresh each live match's docs in parallel; one failure shouldn't
    // poison the batch.
    const results = await Promise.allSettled(
      live.map((m) => refreshOneLiveMatch(m)),
    )
    const failed = results.filter((r) => r.status === 'rejected').length

    await stateRef.set(
      {
        live_window_active: true,
        next_run_at: Timestamp.fromMillis(startedAt + 60_000),
      },
      { merge: true },
    )

    logger.info('refreshLiveMatches.done', {
      live: live.length,
      failed,
      ms: Date.now() - startedAt,
    })
  },
)

async function refreshOneLiveMatch(match: Match): Promise<void> {
  const matchId = match.id
  try {
    // 1. Re-pull the canonical match row (status / score may have changed).
    let canonical = match
    try {
      const page = await request<FIFAList<FIFAMatch>>('/matches', {
        'match_ids[]': [matchId],
      })
      const row = page.data[0]
      if (row) canonical = mapMatch(row)
    } catch (err) {
      if (err instanceof UpstreamServerError) {
        logger.warn('refreshLiveMatches.match_5xx', { matchId, err: String(err) })
      } else if (!(err instanceof TierRequiredError)) {
        throw err
      }
    }

    await writeThrough(
      'matches',
      matchKey(matchId),
      ttlForMatch(canonical.status),
      canonical,
    )

    // 2. Re-fan events + team_stats + lineups. lineups rarely change but
    //    we re-pull them cheaply alongside the others.
    const [lineupsRes, eventsRes, statsRes] = await Promise.allSettled([
      paginate<FIFAMatchLineupRow>('/match_lineups', {
        'match_ids[]': [matchId],
      }),
      paginate<FIFAMatchEvent>('/match_events', { 'match_ids[]': [matchId] }),
      paginate<FIFATeamMatchStats>('/team_match_stats', {
        'match_ids[]': [matchId],
      }),
    ])

    const tierRequired: { lineups?: boolean; events?: boolean; stats?: boolean } = {}

    let lineupRows: FIFAMatchLineupRow[]
    if (lineupsRes.status === 'fulfilled') {
      lineupRows = lineupsRes.value
    } else {
      tierRequired.lineups = isTier(lineupsRes.reason)
      lineupRows = []
    }

    let events: FIFAMatchEvent[]
    if (eventsRes.status === 'fulfilled') {
      events = eventsRes.value
    } else {
      tierRequired.events = isTier(eventsRes.reason)
      events = []
    }

    let teamStatsRows: FIFATeamMatchStats[]
    if (statsRes.status === 'fulfilled') {
      teamStatsRows = statsRes.value
    } else {
      tierRequired.stats = isTier(statsRes.reason)
      teamStatsRows = []
    }

    const details = composeMatchDetails({
      matchId,
      match: canonical,
      lineupRows,
      events,
      teamStatsRows,
      tier_required: Object.keys(tierRequired).length ? tierRequired : undefined,
    })

    await writeThrough(
      'matchDetails',
      matchDetailsKey(matchId),
      ttlForMatchDetails(canonical.status),
      details,
      'scheduler',
    )
  } catch (err) {
    if (err instanceof TierRequiredError) return
    if (err instanceof UpstreamServerError) {
      logger.warn('refreshLiveMatches.section_5xx', { matchId, err: String(err) })
      return
    }
    logger.error('refreshLiveMatches.failed', { matchId, err: String(err) })
  }
}

function isTier(reason: unknown): true {
  if (!(reason instanceof TierRequiredError)) {
    // Non-tier failures we silently absorb but at least surface to logs.
    logger.warn('refreshLiveMatches.section_fail', { err: String(reason) })
  }
  return true
}

// Re-export the constant so tests / other modules can reuse it without
// touching this module's internals.
export const REFRESH_LIVE_IDLE_TTL = TTL.matchesList_live
