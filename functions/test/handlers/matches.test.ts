// Integration-style test for getMatches: cache bypass + paginate stub.
//
// Assertions:
//   - the season is threaded into the upstream query
//   - upstream `status: "completed"` strings are mapped to the internal
//     'FT' enum value
//   - filtering (status, group, date) happens in-memory off the cached
//     full list

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import type { FIFAMatch } from '../../src/upstream/types.js'

const { paginateMock, writeThroughMock } = vi.hoisted(() => ({
  paginateMock: vi.fn(async (_path: string, _query: Record<string, unknown>): Promise<unknown[]> => []),
  writeThroughMock: vi.fn(async () => undefined),
}))

vi.mock('../../src/cache/firestore.js', () => ({
  getOrSet: async <T,>(_c: string, _id: string, _ttl: number, fresh: () => Promise<T>) => ({
    value: await fresh(),
    cacheHit: false,
    stale: false,
    frozen: false,
  }),
  writeThrough: writeThroughMock,
  setFrozen: vi.fn(async () => undefined),
}))

vi.mock('../../src/middleware/rateLimit.js', () => ({
  withRateLimit: <T,>(fn: T) => fn,
}))
vi.mock('../../src/middleware/appCheck.js', () => ({
  APP_CHECK_OPTS: {},
}))

vi.mock('../../src/upstream/client.js', () => ({
  paginate: paginateMock,
  request: vi.fn(),
}))

vi.mock('../../src/firebase.js', () => ({
  db: {
    collection: () => ({ doc: () => ({ get: async () => ({ exists: false }) }) }),
    doc: () => ({ set: async () => undefined }),
  },
}))

import { getMatches } from '../../src/handlers/matches.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadFixture<T>(name: string): { data: T[] } {
  return JSON.parse(
    readFileSync(join(__dirname, '..', 'fixtures', 'upstream', name), 'utf8'),
  ) as { data: T[] }
}

interface CallableHandle {
  run: (req: { data: unknown }) => Promise<{ data: unknown[] }>
}

describe('handlers/getMatches', () => {
  it('threads season=2022 and maps "completed" status -> "FT"', async () => {
    const fx = loadFixture<FIFAMatch>('matches_2022_p1.json')
    paginateMock.mockResolvedValueOnce(fx.data)

    const handle = getMatches as unknown as CallableHandle
    const res = (await handle.run({ data: { season: 2022 } })) as {
      data: Array<{ status: string }>
    }

    expect(paginateMock).toHaveBeenCalledWith(
      '/matches',
      expect.objectContaining({ 'seasons[]': [2022] }),
    )
    expect(res.data.length).toBeGreaterThan(0)
    // Every match in the 2022 fixture is `completed` upstream → 'FT' internal.
    const allFt = res.data.every((m) => m.status === 'FT')
    expect(allFt).toBe(true)
  })

  it('filters by status in-memory', async () => {
    const fx = loadFixture<FIFAMatch>('matches_2022_p1.json')
    paginateMock.mockResolvedValueOnce(fx.data)

    const handle = getMatches as unknown as CallableHandle
    const all = (await handle.run({ data: { season: 2022 } })) as {
      data: Array<{ status: string }>
    }
    paginateMock.mockResolvedValueOnce(fx.data)
    const sched = (await handle.run({
      data: { season: 2022, status: 'SCHED' },
    })) as { data: Array<{ status: string }> }
    // No scheduled matches in the historical fixture.
    expect(sched.data).toHaveLength(0)
    expect(all.data.length).toBeGreaterThan(0)
  })

  it('filters by group letter', async () => {
    const fx = loadFixture<FIFAMatch>('matches_2022_p1.json')
    paginateMock.mockResolvedValueOnce(fx.data)

    const handle = getMatches as unknown as CallableHandle
    const groupA = (await handle.run({
      data: { season: 2022, group: 'A' },
    })) as { data: Array<{ group: string | null }> }
    expect(groupA.data.length).toBeGreaterThan(0)
    expect(groupA.data.every((m) => m.group === 'A')).toBe(true)
  })

  it('sorts results by kickoff_iso ascending', async () => {
    const fx = loadFixture<FIFAMatch>('matches_2022_p1.json')
    paginateMock.mockResolvedValueOnce(fx.data)

    const handle = getMatches as unknown as CallableHandle
    const all = (await handle.run({ data: { season: 2022 } })) as {
      data: Array<{ kickoff_iso: string }>
    }
    for (let i = 1; i < all.data.length; i++) {
      const prev = all.data[i - 1]!.kickoff_iso
      const cur = all.data[i]!.kickoff_iso
      expect(prev <= cur).toBe(true)
    }
  })
})
