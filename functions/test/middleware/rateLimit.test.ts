// Integration test for withRateLimit. This exercises the real Firestore
// document path (rate_buckets/{uid}) — the path bug caught in code review
// would have been invisible otherwise because handler tests mock the
// middleware out wholesale.

import { describe, it, expect, beforeEach, vi } from 'vitest'

interface DocSnapshot {
  exists: boolean
  data(): Record<string, unknown> | undefined
}

interface TxRef {
  _path: string
  _exists: boolean
  _data: Record<string, unknown>
}

interface FakeTx {
  get(ref: TxRef): Promise<DocSnapshot>
  set(ref: TxRef, data: Record<string, unknown>): void
}

class FakeFirestore {
  private docs = new Map<string, Record<string, unknown>>()

  collection(name: string) {
    return {
      doc: (id: string) => {
        const path = `${name}/${id}`
        const self = this
        const ref: TxRef = {
          _path: path,
          get _exists() {
            return self.docs.has(path)
          },
          get _data() {
            return self.docs.get(path) ?? {}
          },
        }
        return ref
      },
    }
  }

  doc(path: string): TxRef {
    // Enforce the same even-segment invariant the real Firestore enforces.
    const segs = path.split('/').filter(Boolean)
    if (segs.length % 2 !== 0) {
      throw new Error(
        `Value for argument "documentPath" must point to a document, but was "${path}". Your path does not contain an even number of components.`,
      )
    }
    const self = this
    return {
      _path: path,
      get _exists() {
        return self.docs.has(path)
      },
      get _data() {
        return self.docs.get(path) ?? {}
      },
    }
  }

  async runTransaction<T>(fn: (tx: FakeTx) => Promise<T>): Promise<T> {
    const writes: Array<[string, Record<string, unknown>]> = []
    const tx: FakeTx = {
      get: async (ref) => ({
        exists: ref._exists,
        data: () => (ref._exists ? ref._data : undefined),
      }),
      set: (ref, data) => {
        writes.push([ref._path, data])
      },
    }
    const result = await fn(tx)
    for (const [path, data] of writes) this.docs.set(path, data)
    return result
  }
}

const fakeDb = new FakeFirestore()

vi.mock('../../src/firebase.js', () => ({ db: fakeDb }))

const { withRateLimit } = await import('../../src/middleware/rateLimit.js')

function makeReq(uid: string | undefined) {
  return { auth: uid ? { uid } : undefined } as Parameters<typeof withRateLimit>[0] extends (req: infer R) => unknown ? R : never
}

beforeEach(() => {
  // Reset the in-memory store.
  // @ts-expect-error reaching into the fake for test reset
  fakeDb.docs = new Map()
  delete process.env.FUNCTIONS_EMULATOR
})

describe('withRateLimit', () => {
  it('uses a valid even-segment Firestore document path', async () => {
    // The bug we're guarding against: `db.doc("meta/rate_buckets/uid")` is
    // a 3-segment path and throws. The fix uses `rate_buckets/uid` (2 segs).
    const handler = vi.fn().mockResolvedValue('ok')
    const wrapped = withRateLimit(handler as never)
    // Must not throw with "even number of components" — the fake mirrors
    // the real Firestore validation.
    await expect(wrapped(makeReq('alice') as never)).resolves.toBe('ok')
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('rejects unauthenticated requests in production', async () => {
    const handler = vi.fn().mockResolvedValue('never')
    const wrapped = withRateLimit(handler as never)
    await expect(wrapped(makeReq(undefined) as never)).rejects.toMatchObject({
      code: 'unauthenticated',
    })
    expect(handler).not.toHaveBeenCalled()
  })

  it('allows unauthenticated requests under the emulator', async () => {
    process.env.FUNCTIONS_EMULATOR = 'true'
    const handler = vi.fn().mockResolvedValue('ok')
    const wrapped = withRateLimit(handler as never)
    await expect(wrapped(makeReq(undefined) as never)).resolves.toBe('ok')
  })

  it('refuses after the bucket is drained, refills after a delay', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-12T00:00:00Z'))
    const handler = vi.fn().mockResolvedValue('ok')
    const wrapped = withRateLimit(handler as never)
    // 60 consecutive calls drain the bucket.
    for (let i = 0; i < 60; i++) {
      await wrapped(makeReq('bob') as never)
    }
    // 61st rejects.
    await expect(wrapped(makeReq('bob') as never)).rejects.toMatchObject({
      code: 'resource-exhausted',
    })
    // After ~10s, refilled enough for one more.
    vi.advanceTimersByTime(11_000)
    await expect(wrapped(makeReq('bob') as never)).resolves.toBe('ok')
    vi.useRealTimers()
  })
})
