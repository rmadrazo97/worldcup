// freezeCompletedSeasons — daily 05:00 UTC. Implements the freeze rule
// from docs/plan/01-architecture.md § 6 / 03-backend-functions.md § 8.4.
//
// Two responsibilities:
//   (a) Per-match grace freeze. Any `status === 'FT'` match whose kickoff
//       is at least 24 h in the past gets _frozen=true plus the matching
//       matchDetails + lineups docs.
//   (b) Per-season cohort freeze. When every match in a season is FT and
//       the most recent FT is ≥ 14 days old, we freeze every cached doc
//       carrying that season — teams, stadiums, standings, matches,
//       matchDetails, lineups, rosters, players. From that point on the
//       season is fully self-hosted: zero upstream calls, indefinite
//       retention (`_expiresAt = year-9999`).
//
// Idempotent: a doc that is already `_frozen: true` is skipped.

import { onSchedule } from 'firebase-functions/v2/scheduler'
import {
  FieldValue,
  Timestamp,
  type DocumentReference,
} from 'firebase-admin/firestore'
import { SCHEDULER } from '../config.js'
import { db } from '../firebase.js'
import { FROZEN_EXPIRES_AT_MS } from '../util/ttl.js'
import { logger } from '../util/logging.js'

const GRACE_MS_FT = 24 * 60 * 60 * 1000
const GRACE_MS_SEASON = 14 * 24 * 60 * 60 * 1000
const SEASONS = [2018, 2022, 2026] as const

type FreezeReason = 'match-ft-grace' | 'season-complete' | 'manual'

export const freezeCompletedSeasons = onSchedule(
  { schedule: '0 5 * * *', timeZone: 'UTC', ...SCHEDULER },
  async () => {
    const now = Date.now()
    logger.info('freeze.start')

    // (a) per-match grace freeze
    const cutoff = new Date(now - GRACE_MS_FT).toISOString()
    const ftMatches = await db
      .collection('matches')
      .where('payload.status', '==', 'FT')
      .where('payload.kickoff_iso', '<', cutoff)
      .get()
    let perMatchFrozen = 0
    for (const snap of ftMatches.docs) {
      if (snap.data()._frozen === true) continue
      await freezeDoc(snap.ref, 'match-ft-grace')
      const id = snap.id.replace(/^match_/, '')
      const detailsRef = db.collection('matchDetails').doc(`details_${id}`)
      const lineupsRef = db.collection('lineups').doc(`lineups_${id}`)
      await Promise.allSettled([
        freezeDoc(detailsRef, 'match-ft-grace'),
        freezeDoc(lineupsRef, 'match-ft-grace'),
      ])
      perMatchFrozen++
    }

    // (b) per-season cohort freeze
    let seasonsFrozen = 0
    for (const season of SEASONS) {
      const stateRef = db.collection('meta').doc(`seasonStatus_${season}`)
      const state = await stateRef.get()
      if (state.exists && state.data()?.frozen === true) continue
      const complete = await isSeasonFullyComplete(season, now)
      if (!complete) continue
      await freezeAllForSeason(season)
      await stateRef.set(
        {
          season,
          frozen: true,
          frozenAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
      seasonsFrozen++
      logger.info('season.frozen', { season })
    }

    logger.info('freeze.complete', { perMatchFrozen, seasonsFrozen })
  },
)

async function freezeDoc(
  ref: DocumentReference,
  reason: FreezeReason,
): Promise<void> {
  await ref.set(
    {
      _frozen: true,
      _frozenAt: FieldValue.serverTimestamp(),
      _frozenReason: reason,
      _expiresAt: Timestamp.fromMillis(FROZEN_EXPIRES_AT_MS),
    },
    { merge: true },
  )
}

async function isSeasonFullyComplete(
  season: number,
  now: number,
): Promise<boolean> {
  const all = await db
    .collection('matches')
    .where('payload.season', '==', season)
    .get()
  if (all.empty) return false
  let mostRecentFt = 0
  for (const d of all.docs) {
    const m = d.data()?.payload
    if (!m || m.status !== 'FT') return false
    const t = Date.parse(m.kickoff_iso)
    if (Number.isNaN(t)) return false
    if (t > mostRecentFt) mostRecentFt = t
  }
  return mostRecentFt > 0 && now - mostRecentFt >= GRACE_MS_SEASON
}

async function freezeAllForSeason(season: number): Promise<void> {
  const collections = [
    'teams',
    'stadiums',
    'groups',
    'standings',
    'matches',
    'matchDetails',
    'lineups',
    'rosters',
    'players',
  ]
  for (const col of collections) {
    // Per-record docs carry `payload.season`. List/aggregate docs don't —
    // they're keyed by docId pattern (`<resource>_<season>`, see
    // functions/src/cache/keys.ts). Walk both so the cohort sweep covers
    // every cached doc for the season, not just the per-record ones.
    const byField = await db
      .collection(col)
      .where('payload.season', '==', season)
      .get()
    for (const snap of byField.docs) {
      if (snap.data()._frozen === true) continue
      await freezeDoc(snap.ref, 'season-complete')
    }

    const all = await db.collection(col).get()
    const suffix = `_${season}`
    for (const snap of all.docs) {
      if (!snap.id.includes(suffix)) continue
      if (snap.data()._frozen === true) continue
      await freezeDoc(snap.ref, 'season-complete')
    }
  }
}
