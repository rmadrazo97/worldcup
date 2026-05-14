// Integration-style test for the getTeams callable. We don't spin up the
// Functions emulator; instead we mock the cache layer (so getOrSet calls
// straight through to the fresh function), the upstream client (so
// paginate returns the fixture), and the rate-limit + appcheck middleware
// (so we don't need an authenticated request).
//
// We invoke the handler by reaching into its `.run({ data })` method —
// firebase-functions v2 attaches this to every CallableFunction.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import type { FIFATeam } from '../../src/upstream/types.js'

const { paginateMock } = vi.hoisted(() => ({
  paginateMock: vi.fn(async (_path: string, _query: Record<string, unknown>): Promise<unknown[]> => []),
}))

// Bypass the cache: invoke the fresh function directly and return its
// value in the canonical CacheReadResult envelope.
vi.mock('../../src/cache/firestore.js', () => ({
  getOrSet: async <T,>(_c: string, _id: string, _ttl: number, fresh: () => Promise<T>) => ({
    value: await fresh(),
    cacheHit: false,
    stale: false,
    frozen: false,
  }),
  writeThrough: vi.fn(async () => undefined),
  setFrozen: vi.fn(async () => undefined),
}))

// Identity middlewares so we don't need rate-bucket Firestore docs or
// App Check tokens for unit testing.
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

// Firebase admin db isn't touched after mocks above, but the import chain
// pulls it in via firebase.ts; stub minimally.
vi.mock('../../src/firebase.js', () => ({
  db: {
    collection: () => ({ doc: () => ({ get: async () => ({ exists: false }) }) }),
    doc: () => ({ set: async () => undefined }),
  },
}))

import { getTeams } from '../../src/handlers/teams.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadFixture<T>(name: string): { data: T[] } {
  return JSON.parse(
    readFileSync(join(__dirname, '..', 'fixtures', 'upstream', name), 'utf8'),
  ) as { data: T[] }
}

interface CallableHandle {
  run: (req: { data: unknown }) => Promise<{ data: unknown[] }>
}

describe('handlers/getTeams', () => {
  it('returns 32 mapped teams for season 2022', async () => {
    const fx = loadFixture<FIFATeam>('teams_2022.json')
    paginateMock.mockResolvedValueOnce(fx.data)

    const handle = getTeams as unknown as CallableHandle
    const res = await handle.run({ data: { season: 2022 } })

    expect(paginateMock).toHaveBeenCalledWith(
      '/teams',
      expect.objectContaining({ 'seasons[]': [2022] }),
    )
    expect(Array.isArray(res.data)).toBe(true)
    expect(res.data).toHaveLength(32)
    const first = res.data[0] as { id: number; short: string; code: string; name: string }
    expect(typeof first.id).toBe('number')
    expect(first.short).toMatch(/^[A-Z]{3}$/)
    expect(first.code.length).toBeGreaterThan(0)
    expect(first.name.length).toBeGreaterThan(0)
  })

  it('threads season=2026 into the upstream query', async () => {
    const fx = loadFixture<FIFATeam>('teams_2026.json')
    paginateMock.mockResolvedValueOnce(fx.data)

    const handle = getTeams as unknown as CallableHandle
    await handle.run({ data: { season: 2026 } })

    expect(paginateMock).toHaveBeenLastCalledWith(
      '/teams',
      expect.objectContaining({ 'seasons[]': [2026] }),
    )
  })

  it('soft-empties on TierRequiredError', async () => {
    const { TierRequiredError } = await import('../../src/upstream/errors.js')
    paginateMock.mockRejectedValueOnce(new TierRequiredError('/teams', 402))

    const handle = getTeams as unknown as CallableHandle
    const res = (await handle.run({ data: { season: 2022 } })) as {
      data: unknown[]
      tier_required?: boolean
    }
    expect(res.data).toEqual([])
    expect(res.tier_required).toBe(true)
  })
})
