// freezeCompletedSeasons scheduler — in-memory db fake.
//
// Scenarios:
//   (a) FT match older than 24h becomes _frozen=true with year-9999
//       _expiresAt.
//   (b) Related matchDetails + lineups docs get the same freeze fields.
//   (c) Already-frozen docs are a no-op (the matching test ensures
//       _frozenReason isn't rewritten).
//   (d) A season where every match is FT and the most recent FT is
//       ≥ 14 days old triggers cohort freeze on the meta state doc and
//       every doc carrying that season.

import { describe, expect, it, vi, beforeEach } from 'vitest'

// vi.hoisted runs BEFORE vi.mock factories and before any imports.
// Classes defined here are available to the mock factory below.
const { store, fakeDb } = vi.hoisted(() => {
  const store = new Map<string, Record<string, unknown>>()

  function getDeep(obj: Record<string, unknown>, dotted: string): unknown {
    return dotted.split('.').reduce<unknown>(
      (acc, key) =>
        acc !== undefined && acc !== null && typeof acc === 'object'
          ? (acc as Record<string, unknown>)[key]
          : undefined,
      obj,
    )
  }

  function matchOne(
    data: Record<string, unknown>,
    field: string,
    op: string,
    value: unknown,
  ): boolean {
    const left = getDeep(data, field)
    switch (op) {
      case '==':
        return left === value
      case '<':
        if (typeof left === 'string' && typeof value === 'string') {
          return left < value
        }
        return Number(left) < Number(value)
      case '!=':
        return left !== value
      default:
        return false
    }
  }

  class FakeRef {
    constructor(public path: string) {}
    get id(): string {
      const parts = this.path.split('/')
      return parts[parts.length - 1] ?? ''
    }
    async get(): Promise<{
      exists: boolean
      id: string
      data: () => Record<string, unknown> | undefined
      ref: FakeRef
    }> {
      const v = store.get(this.path)
      return {
        exists: v !== undefined,
        id: this.id,
        data: () => v,
        ref: this,
      }
    }
    async set(data: Record<string, unknown>, opts?: { merge?: boolean }): Promise<void> {
      if (opts?.merge) {
        const prev = store.get(this.path) ?? {}
        store.set(this.path, { ...prev, ...data })
      } else {
        store.set(this.path, data)
      }
    }
    async update(data: Record<string, unknown>): Promise<void> {
      const prev = store.get(this.path) ?? {}
      store.set(this.path, { ...prev, ...data })
    }
  }

  class FakeQuery {
    constructor(
      public collection: string,
      public filters: Array<[string, string, unknown]> = [],
    ) {}
    where(field: string, op: string, value: unknown): FakeQuery {
      return new FakeQuery(this.collection, [...this.filters, [field, op, value]])
    }
    async get(): Promise<{ empty: boolean; docs: Array<ReturnType<FakeRef['get']> extends Promise<infer R> ? R : never> }> {
      const docs: Array<{
        exists: boolean
        id: string
        data: () => Record<string, unknown> | undefined
        ref: FakeRef
      }> = []
      for (const [path, data] of store.entries()) {
        if (!path.startsWith(this.collection + '/')) continue
        if (this.filters.every(([f, o, v]) => matchOne(data, f, o, v))) {
          const ref = new FakeRef(path)
          docs.push({ exists: true, id: ref.id, data: () => data, ref })
        }
      }
      return { empty: docs.length === 0, docs }
    }
  }

  const fakeDb = {
    collection: (name: string) => ({
      doc: (id: string) => new FakeRef(`${name}/${id}`),
      where: (field: string, op: string, value: unknown) =>
        new FakeQuery(name).where(field, op, value),
      // Bare .get() returns every doc under the collection — used by the
      // freezer's per-docId sweep (list/aggregate docs lack payload.season).
      get: async () => {
        const docs: Array<{
          exists: boolean
          id: string
          data: () => Record<string, unknown> | undefined
          ref: FakeRef
        }> = []
        for (const [path, data] of store.entries()) {
          if (!path.startsWith(name + '/')) continue
          const ref = new FakeRef(path)
          docs.push({ exists: true, id: ref.id, data: () => data, ref })
        }
        return { empty: docs.length === 0, docs }
      },
    }),
    doc: (path: string) => new FakeRef(path),
  }

  return { store, fakeDb }
})

vi.mock('../../src/firebase.js', () => ({ db: fakeDb }))

import { freezeCompletedSeasons } from '../../src/schedulers/freezeCompletedSeasons.js'
import { FROZEN_EXPIRES_AT_MS } from '../../src/util/ttl.js'

interface ScheduledHandle {
  run: (event?: unknown) => Promise<void>
}

beforeEach(() => {
  store.clear()
})

describe('schedulers/freezeCompletedSeasons', () => {
  it('freezes an FT match whose kickoff is older than 24h plus its details + lineups', async () => {
    const oldIso = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    store.set('matches/match_1000', {
      payload: { status: 'FT', kickoff_iso: oldIso, season: 2022 },
    })
    store.set('matchDetails/details_1000', {
      payload: { matchId: '1000' },
    })
    store.set('lineups/lineups_1000', {
      payload: { home: null, away: null },
    })

    const handle = freezeCompletedSeasons as unknown as ScheduledHandle
    await handle.run({})

    const match = store.get('matches/match_1000')
    expect(match?._frozen).toBe(true)
    expect(match?._frozenReason).toBe('match-ft-grace')
    const expiresAt = match?._expiresAt as { toMillis: () => number } | undefined
    expect(expiresAt?.toMillis()).toBe(FROZEN_EXPIRES_AT_MS)

    const details = store.get('matchDetails/details_1000')
    expect(details?._frozen).toBe(true)
    expect(details?._frozenReason).toBe('match-ft-grace')

    const lineups = store.get('lineups/lineups_1000')
    expect(lineups?._frozen).toBe(true)
  })

  it('skips an FT match whose kickoff is within the 24h grace', async () => {
    const recentIso = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    store.set('matches/match_2000', {
      payload: { status: 'FT', kickoff_iso: recentIso, season: 2026 },
    })

    const handle = freezeCompletedSeasons as unknown as ScheduledHandle
    await handle.run({})

    expect(store.get('matches/match_2000')?._frozen).toBeUndefined()
  })

  it('is idempotent: an already-frozen doc is not re-frozen', async () => {
    const oldIso = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const prevFrozenAt = { sentinel: 'previous' }
    store.set('matches/match_3000', {
      payload: { status: 'FT', kickoff_iso: oldIso, season: 2022 },
      _frozen: true,
      _frozenAt: prevFrozenAt,
      _frozenReason: 'manual',
    })

    const handle = freezeCompletedSeasons as unknown as ScheduledHandle
    await handle.run({})

    const doc = store.get('matches/match_3000')
    expect(doc?._frozen).toBe(true)
    // Reason should not be overwritten on re-run.
    expect(doc?._frozenReason).toBe('manual')
    expect(doc?._frozenAt).toBe(prevFrozenAt)
  })

  it('triggers per-season cohort freeze when all matches are FT for >= 14 days', async () => {
    const longAgoIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    // Two matches, both FT, both ≥ 14 days old. Season 2018.
    store.set('matches/match_5001', {
      payload: { status: 'FT', kickoff_iso: longAgoIso, season: 2018 },
    })
    store.set('matches/match_5002', {
      payload: { status: 'FT', kickoff_iso: longAgoIso, season: 2018 },
    })
    store.set('teams/teams_2018', {
      payload: {
        data: [{ id: 1, short: 'BRA', name: 'Brazil', code: 'br', confederation: null }],
        season: 2018,
      },
    })
    store.set('stadiums/stadiums_2018', {
      payload: { data: [], season: 2018 },
    })

    const handle = freezeCompletedSeasons as unknown as ScheduledHandle
    await handle.run({})

    const seasonState = store.get('meta/seasonStatus_2018')
    expect(seasonState?.frozen).toBe(true)
    expect(seasonState?.season).toBe(2018)

    // Cohort freeze also stamps teams + stadiums + matches.
    expect(store.get('teams/teams_2018')?._frozen).toBe(true)
    expect(store.get('stadiums/stadiums_2018')?._frozen).toBe(true)
    expect(store.get('matches/match_5001')?._frozen).toBe(true)
  })

  it('cohort freeze also covers list/aggregate docs that lack payload.season', async () => {
    // Production list docs (e.g. matches/matches_2018) are written with a
    // payload of `{ data: [...] }` — no season field on the payload itself.
    // The freezer must still pin them via docId convention.
    const longAgoIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    store.set('matches/match_6001', {
      payload: { status: 'FT', kickoff_iso: longAgoIso, season: 2018 },
    })
    // List/aggregate docs — no season field on payload.
    store.set('matches/matches_2018', { payload: { data: [] } })
    store.set('groups/groups_2018', { payload: { data: [] } })
    store.set('standings/standings_2018', { payload: { data: [] } })

    const handle = freezeCompletedSeasons as unknown as ScheduledHandle
    await handle.run({})

    expect(store.get('matches/matches_2018')?._frozen).toBe(true)
    expect(store.get('groups/groups_2018')?._frozen).toBe(true)
    expect(store.get('standings/standings_2018')?._frozen).toBe(true)
  })
})
