// matchDetails composite handler test.
//
// We stub the three parallel upstream calls (/match_lineups, /match_events,
// /team_match_stats) and assert:
//   1. composeMatchDetails is invoked exactly once with all three sections.
//   2. When one of the three calls rejects with TierRequiredError, the
//      `tier_required.<section>` flag flips to true and the others remain
//      populated.
//   3. A non-tier reject propagates instead of being silently swallowed.

import { describe, expect, it, vi, beforeEach } from 'vitest'

const { paginateMock, requestMock, composeSpy } = vi.hoisted(() => ({
  paginateMock: vi.fn(async (_path: string, _query: Record<string, unknown>): Promise<unknown[]> => []),
  requestMock: vi.fn(async (_path: string, _query: Record<string, unknown>): Promise<unknown> => ({})),
  composeSpy: vi.fn((_args: unknown) => undefined),
}))

vi.mock('../../src/upstream/client.js', () => ({
  paginate: paginateMock,
  request: requestMock,
}))

// Stub the canonical match read: pretend the cache has match_1000.
const fakeMatch = {
  id: '1000',
  season: 2022,
  stage: 'group',
  stage_label: 'Group A · MD 1',
  group: 'A',
  md: 1,
  home: 'ARG',
  away: 'KSA',
  homeId: 37,
  awayId: 31,
  hs: 1,
  as: 2,
  pens: null,
  status: 'FT',
  minute: null,
  kickoff_iso: '2022-11-22T10:00:00.000Z',
  venueId: null,
  venueShort: null,
  home_formation: null,
  away_formation: null,
  referee: null,
  attendance: null,
}

vi.mock('../../src/firebase.js', () => ({
  db: {
    collection: (_name: string) => ({
      doc: (_id: string) => ({
        get: async () => ({
          exists: true,
          data: () => ({
            payload: fakeMatch,
            _expiresAt: { toMillis: () => Date.now() + 60_000 },
          }),
        }),
        set: async () => undefined,
      }),
    }),
    doc: () => ({ set: async () => undefined }),
  },
}))

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

vi.mock('../../src/middleware/rateLimit.js', () => ({
  withRateLimit: <T,>(fn: T) => fn,
}))
vi.mock('../../src/middleware/appCheck.js', () => ({
  APP_CHECK_OPTS: {},
}))

vi.mock('../../src/mappers/match-details.js', () => ({
  composeMatchDetails: (args: unknown) => {
    composeSpy(args)
    const a = args as { matchId: string; tier_required?: unknown }
    return {
      matchId: a.matchId,
      lineups: { home: null, away: null },
      events: [],
      stats: null,
      attendance: null,
      ...(a.tier_required ? { tier_required: a.tier_required } : {}),
    }
  },
}))

import { getMatchDetails } from '../../src/handlers/matchDetails.js'
import { TierRequiredError } from '../../src/upstream/errors.js'

interface CallableHandle {
  run: (req: { data: unknown }) => Promise<{ data: { matchId: string; tier_required?: Record<string, boolean> } }>
}

beforeEach(() => {
  paginateMock.mockReset()
  requestMock.mockReset()
  composeSpy.mockReset()
})

describe('handlers/getMatchDetails', () => {
  it('composes all three sections in parallel', async () => {
    paginateMock.mockImplementation(async (path: string) => {
      if (path === '/match_lineups') return [{ kind: 'lineup' }]
      if (path === '/match_events') return [{ kind: 'event' }]
      if (path === '/team_match_stats') return [{ kind: 'stat' }]
      return []
    })

    const handle = getMatchDetails as unknown as CallableHandle
    const res = await handle.run({
      data: { season: 2022, matchId: '1000' },
    })

    expect(paginateMock).toHaveBeenCalledTimes(3)
    expect(composeSpy).toHaveBeenCalledTimes(1)
    const composeArg = composeSpy.mock.calls[0]![0] as {
      lineupRows: unknown[]
      events: unknown[]
      teamStatsRows: unknown[]
      tier_required?: unknown
    }
    expect(composeArg.lineupRows).toHaveLength(1)
    expect(composeArg.events).toHaveLength(1)
    expect(composeArg.teamStatsRows).toHaveLength(1)
    expect(composeArg.tier_required).toBeUndefined()
    expect(res.data.matchId).toBe('1000')
  })

  it('flags only the tier-gated section when one rejects with TierRequiredError', async () => {
    paginateMock.mockImplementation(async (path: string) => {
      if (path === '/match_lineups') return [{ kind: 'lineup' }]
      if (path === '/match_events') {
        throw new TierRequiredError('/match_events', 402)
      }
      if (path === '/team_match_stats') return [{ kind: 'stat' }]
      return []
    })

    const handle = getMatchDetails as unknown as CallableHandle
    const res = await handle.run({
      data: { season: 2022, matchId: '1000' },
    })

    const composeArg = composeSpy.mock.calls[0]![0] as {
      lineupRows: unknown[]
      events: unknown[]
      teamStatsRows: unknown[]
      tier_required?: { lineups?: boolean; events?: boolean; stats?: boolean }
    }
    expect(composeArg.tier_required).toEqual({ events: true })
    expect(composeArg.lineupRows).toHaveLength(1)
    expect(composeArg.teamStatsRows).toHaveLength(1)
    expect(res.data.tier_required).toEqual({ events: true })
  })

  it('propagates non-tier rejections', async () => {
    paginateMock.mockImplementation(async (path: string) => {
      if (path === '/match_lineups') throw new Error('boom')
      return []
    })

    const handle = getMatchDetails as unknown as CallableHandle
    await expect(
      handle.run({ data: { season: 2022, matchId: '1000' } }),
    ).rejects.toThrow(/boom/)
  })
})
