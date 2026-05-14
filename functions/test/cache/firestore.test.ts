import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Timestamp, type DocumentReference } from 'firebase-admin/firestore'

// vi.hoisted runs BEFORE vi.mock factories and before any imports.
// We define the in-memory fake here so the mock factory below can
// reference it without ReferenceError.
const { store, fakeDb } = vi.hoisted(() => {
  const store = new Map<string, Record<string, unknown>>()

  class FakeRef {
    constructor(public path: string) {}
    async get(): Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }> {
      const v = store.get(this.path)
      return { exists: v !== undefined, data: () => v }
    }
    async set(data: Record<string, unknown>, opts?: { merge?: boolean }): Promise<void> {
      if (opts?.merge) {
        const prev = store.get(this.path) ?? {}
        store.set(this.path, { ...prev, ...data })
      } else {
        store.set(this.path, data)
      }
    }
  }

  class FakeCollection {
    constructor(private name: string) {}
    doc(id: string): FakeRef {
      return new FakeRef(`${this.name}/${id}`)
    }
  }

  const fakeDb = {
    collection: (name: string) => new FakeCollection(name),
    doc: (path: string) => new FakeRef(path),
    runTransaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
  }

  return { store, fakeDb }
})

vi.mock('../../src/firebase.js', () => ({ db: fakeDb }))

// Imports come AFTER the mock; vitest hoists vi.mock above these so the
// mocked `db` is what the cache module sees.
import { getOrSet, writeThrough, setFrozen } from '../../src/cache/firestore.js'
import * as mutex from '../../src/cache/mutex.js'

function nowTs(): Timestamp {
  return Timestamp.fromMillis(Date.now())
}
function futureTs(secondsAhead: number): Timestamp {
  return Timestamp.fromMillis(Date.now() + secondsAhead * 1000)
}
function pastTs(secondsAgo: number): Timestamp {
  return Timestamp.fromMillis(Date.now() - secondsAgo * 1000)
}

beforeEach(() => {
  store.clear()
  mutex._resetForTests()
})

describe('cache/firestore.getOrSet', () => {
  it('cache hit (not expired) returns cached payload, no freshFn call', async () => {
    store.set('teams/2022', {
      payload: ['cached'],
      _fetchedAt: nowTs(),
      _expiresAt: futureTs(60),
      _schema: 'v2',
      _source: 'upstream',
    })
    const freshFn = vi.fn(async () => ['fresh'])
    const res = await getOrSet<string[]>('teams', '2022', 60, freshFn)
    expect(res.cacheHit).toBe(true)
    expect(res.stale).toBe(false)
    expect(res.frozen).toBe(false)
    expect(res.value).toEqual(['cached'])
    expect(freshFn).not.toHaveBeenCalled()
  })

  it('miss writes through with the fresh payload', async () => {
    const freshFn = vi.fn(async () => [{ id: 1 }])
    const res = await getOrSet('teams', '2022', 60, freshFn)
    expect(res.cacheHit).toBe(false)
    expect(res.value).toEqual([{ id: 1 }])
    expect(freshFn).toHaveBeenCalledTimes(1)
    const written = store.get('teams/2022')
    expect(written).toBeDefined()
    expect((written as { _schema: string })._schema).toBe('v2')
  })

  it('expired triggers refetch', async () => {
    store.set('teams/2022', {
      payload: ['old'],
      _fetchedAt: pastTs(120),
      _expiresAt: pastTs(60),
      _schema: 'v2',
      _source: 'upstream',
    })
    const freshFn = vi.fn(async () => ['new'])
    const res = await getOrSet<string[]>('teams', '2022', 60, freshFn)
    expect(res.value).toEqual(['new'])
    expect(freshFn).toHaveBeenCalledTimes(1)
    expect(res.cacheHit).toBe(false)
  })

  it('stale-on-error returns last-good when freshFn throws', async () => {
    store.set('teams/2022', {
      payload: ['stale-good'],
      _fetchedAt: pastTs(120),
      _expiresAt: pastTs(60),
      _schema: 'v2',
      _source: 'upstream',
    })
    const freshFn = vi.fn(async () => {
      throw new Error('upstream down')
    })
    const res = await getOrSet<string[]>('teams', '2022', 60, freshFn)
    expect(res.value).toEqual(['stale-good'])
    expect(res.stale).toBe(true)
    expect(res.cacheHit).toBe(true)
  })

  it('propagates error when freshFn throws and no doc exists', async () => {
    const freshFn = vi.fn(async () => {
      throw new Error('upstream down')
    })
    await expect(getOrSet('teams', '2022', 60, freshFn)).rejects.toThrow('upstream down')
  })

  it('_frozen: true short-circuits BEFORE _expiresAt and never calls freshFn', async () => {
    store.set('matches/1000', {
      payload: { id: 1000, status: 'FT' },
      _fetchedAt: pastTs(1_000_000),
      _expiresAt: pastTs(1_000_000), // very expired
      _schema: 'v2',
      _source: 'upstream',
      _frozen: true,
      _frozenAt: pastTs(86_400),
      _frozenReason: 'season-complete',
    })
    const freshFn = vi.fn(async () => ({ id: 1000, status: 'CHANGED' }))
    const res = await getOrSet<{ id: number; status: string }>('matches', '1000', 30, freshFn)
    expect(res.frozen).toBe(true)
    expect(res.value.status).toBe('FT')
    expect(freshFn).not.toHaveBeenCalled()
  })

  it('writeThrough preserves _frozen if it was already true', async () => {
    store.set('matches/1000', {
      payload: { id: 1000, status: 'FT' },
      _fetchedAt: pastTs(1000),
      _expiresAt: pastTs(1000),
      _schema: 'v2',
      _source: 'upstream',
      _frozen: true,
      _frozenAt: pastTs(86_400),
      _frozenReason: 'season-complete',
    })
    await writeThrough('matches', '1000', 60, { id: 1000, status: 'FT', updated: true })
    const after = store.get('matches/1000') as Record<string, unknown>
    expect(after._frozen).toBe(true)
    expect(after._frozenReason).toBe('season-complete')
  })

  it('setFrozen flips _frozen and bumps _expiresAt to year-9999', async () => {
    store.set('matches/1000', { payload: { id: 1000 }, _expiresAt: nowTs(), _schema: 'v2' })
    const ref = fakeDb.collection('matches').doc('1000')
    await setFrozen(ref as unknown as DocumentReference, 'manual')
    const after = store.get('matches/1000') as Record<string, unknown>
    expect(after._frozen).toBe(true)
    expect(after._frozenReason).toBe('manual')
    // _expiresAt should be in the far future
    const exp = after._expiresAt as Timestamp
    expect(exp.toMillis()).toBeGreaterThan(Date.UTC(9000, 0, 1))
  })
})
