// Seed the local Firestore emulator from the captured fixtures so the UI
// can run end-to-end without ever calling balldontlie.
//
// Each fixture file in test/fixtures/upstream/ is parsed, mapped through
// the appropriate mapper, and written to its canonical cache location.
// The filename pattern is the key:
//
//   teams_<season>.json         -> teams/teams_{season}
//   stadiums_<season>.json      -> stadiums/stadiums_{season}
//   matches_<season>_p*.json    -> matches/list_{season}  (and per-match fan-out)
//   group_standings_<season>.json -> standings/{season}_all + per-group
//   match_lineups_match<id>.json -> lineups/lineups_{id}
//   match_events_match<id>.json -> events memo cached inside matchDetails
//   team_match_stats_match<id>.json -> stats memo cached inside matchDetails
//
// Usage:
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 tsx scripts/seed.ts
//
// The script no-ops on a real production project: it refuses to run
// without FIRESTORE_EMULATOR_HOST set, since wiping the live cache from a
// dev machine would be very bad.

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import type {
  FIFAMatch,
  FIFAMatchEvent,
  FIFAMatchLineupRow,
  FIFAStadium,
  FIFAStanding,
  FIFATeam,
  FIFATeamMatchStats,
} from '../src/upstream/types.js'
import { mapTeam } from '../src/mappers/team.js'
import { mapStadium } from '../src/mappers/stadium.js'
import { mapMatch } from '../src/mappers/match.js'
import { mapStanding } from '../src/mappers/standings.js'
import { composeMatchDetails } from '../src/mappers/match-details.js'
import {
  matchKey,
  matchesListKey,
  matchDetailsKey,
  lineupsKey,
  standingsKey,
  stadiumsKey,
  teamsKey,
} from '../src/cache/keys.js'
import { TTL } from '../src/util/ttl.js'
import type { Match } from '../src/internal/types.js'

const here = dirname(fileURLToPath(import.meta.url))
const fixtureDir = resolve(here, '..', 'test', 'fixtures', 'upstream')

interface FixturePayload<T> {
  data: T[]
}

function loadFixture<T>(name: string): FixturePayload<T> {
  const raw = readFileSync(resolve(fixtureDir, name), 'utf8')
  return JSON.parse(raw) as FixturePayload<T>
}

function seasonFromName(name: string): number | null {
  const m = name.match(/_(\d{4})(?:_|\.)/)
  return m && m[1] ? Number(m[1]) : null
}

function matchIdFromName(name: string): string | null {
  const m = name.match(/match(\d+)/)
  return m && m[1] ? m[1] : null
}

async function main(): Promise<void> {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    console.error(
      'refusing to seed: FIRESTORE_EMULATOR_HOST is not set. ' +
        'export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 to enable.',
    )
    process.exit(2)
  }
  if (getApps().length === 0) initializeApp({ projectId: 'demo-worldcup' })
  const db = getFirestore()

  const files = readdirSync(fixtureDir).filter((f) => f.endsWith('.json'))
  const now = Timestamp.now()

  const teamFiles = files.filter((f) => f.startsWith('teams_'))
  const stadiumFiles = files.filter((f) => f.startsWith('stadiums_'))
  const matchFiles = files.filter((f) => f.startsWith('matches_'))
  const standingsFiles = files.filter((f) => f.startsWith('group_standings_'))
  const lineupFiles = files.filter((f) => f.startsWith('match_lineups_'))
  const eventFiles = files.filter((f) => f.startsWith('match_events_'))
  const statsFiles = files.filter((f) => f.startsWith('team_match_stats_'))

  // teams
  for (const name of teamFiles) {
    const season = seasonFromName(name)
    if (!season) continue
    const fx = loadFixture<FIFATeam>(name)
    const mapped = fx.data.map(mapTeam)
    await writeCache(db, 'teams', teamsKey(season), { data: mapped }, TTL.teams, now)
    console.log(`seeded teams_${season} (${mapped.length})`)
  }

  // stadiums
  for (const name of stadiumFiles) {
    const season = seasonFromName(name)
    if (!season) continue
    const fx = loadFixture<FIFAStadium>(name)
    const mapped = fx.data.map(mapStadium)
    await writeCache(db, 'stadiums', stadiumsKey(season), { data: mapped }, TTL.stadiums, now)
    console.log(`seeded stadiums_${season} (${mapped.length})`)
  }

  // matches (group p1+ if any extra pages)
  const matchesBySeason = new Map<number, FIFAMatch[]>()
  for (const name of matchFiles) {
    const season = seasonFromName(name)
    if (!season) continue
    const fx = loadFixture<FIFAMatch>(name)
    const acc = matchesBySeason.get(season) ?? []
    acc.push(...fx.data)
    matchesBySeason.set(season, acc)
  }
  for (const [season, rows] of matchesBySeason.entries()) {
    const mapped = rows
      .map(mapMatch)
      .sort((a, b) => a.kickoff_iso.localeCompare(b.kickoff_iso))
    await writeCache(
      db,
      'matches',
      matchesListKey(season),
      { data: mapped },
      TTL.matchesList,
      now,
    )
    for (const m of mapped) {
      await writeCache(db, 'matches', matchKey(m.id), m, TTL.matchById_finished, now)
    }
    console.log(`seeded matches list_${season} + ${mapped.length} per-match`)
  }

  // standings
  for (const name of standingsFiles) {
    const season = seasonFromName(name)
    if (!season) continue
    const fx = loadFixture<FIFAStanding>(name)
    const mapped = fx.data.map(mapStanding)
    await writeCache(
      db,
      'standings',
      standingsKey(season, null),
      { data: mapped },
      TTL.standings,
      now,
    )
    console.log(`seeded standings_${season} (${mapped.length})`)
  }

  // match details composite — build from the available sub-fixtures.
  const lineupByMatch = new Map<string, FIFAMatchLineupRow[]>()
  for (const name of lineupFiles) {
    const id = matchIdFromName(name)
    if (!id) continue
    const fx = loadFixture<FIFAMatchLineupRow>(name)
    lineupByMatch.set(id, fx.data)
    await writeCache(
      db,
      'lineups',
      lineupsKey(id),
      // Defer to mapper at lookup-time; cache the raw mapped pair too.
      { raw: fx.data },
      TTL.lineups,
      now,
    )
  }
  const eventsByMatch = new Map<string, FIFAMatchEvent[]>()
  for (const name of eventFiles) {
    const id = matchIdFromName(name)
    if (!id) continue
    const fx = loadFixture<FIFAMatchEvent>(name)
    eventsByMatch.set(id, fx.data)
  }
  const statsByMatch = new Map<string, FIFATeamMatchStats[]>()
  for (const name of statsFiles) {
    const id = matchIdFromName(name)
    if (!id) continue
    const fx = loadFixture<FIFATeamMatchStats>(name)
    statsByMatch.set(id, fx.data)
  }

  // Compose matchDetails docs for any match that has at least one section.
  const matchIds = new Set<string>([
    ...lineupByMatch.keys(),
    ...eventsByMatch.keys(),
    ...statsByMatch.keys(),
  ])
  for (const matchId of matchIds) {
    // Pull the canonical match from what we already seeded.
    const matchSnap = await db.collection('matches').doc(matchKey(matchId)).get()
    if (!matchSnap.exists) continue
    const match = matchSnap.data()?.payload as Match | undefined
    if (!match) continue
    const details = composeMatchDetails({
      matchId,
      match,
      lineupRows: lineupByMatch.get(matchId) ?? [],
      events: eventsByMatch.get(matchId) ?? [],
      teamStatsRows: statsByMatch.get(matchId) ?? [],
    })
    await writeCache(
      db,
      'matchDetails',
      matchDetailsKey(matchId),
      details,
      TTL.matchDetails_finished,
      now,
    )
    console.log(`seeded matchDetails details_${matchId}`)
  }

  console.log('seed complete')
}

async function writeCache(
  db: FirebaseFirestore.Firestore,
  collection: string,
  docId: string,
  payload: unknown,
  ttlSeconds: number,
  now: Timestamp,
): Promise<void> {
  const expiresAt = Timestamp.fromMillis(now.toMillis() + ttlSeconds * 1000)
  await db
    .collection(collection)
    .doc(docId)
    .set({
      payload,
      _fetchedAt: now,
      _expiresAt: expiresAt,
      _schema: 'v2',
      _source: 'scheduler',
    })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
