// Per-UID token bucket. Capacity 60, refill 1/sec, persisted in
// meta/rate_buckets/{uid}. Implemented as a Firestore transaction so two
// concurrent requests from the same UID cannot overshoot the bucket.

import { HttpsError } from 'firebase-functions/v2/https'
import type { CallableRequest } from 'firebase-functions/v2/https'
import { db } from '../firebase.js'

const CAPACITY = 60
const REFILL_PER_SEC = 1

interface BucketDoc {
  tokens: number
  last_refill_at: number
}

export function withRateLimit<T, R>(
  handler: (req: CallableRequest<T>) => Promise<R>,
): (req: CallableRequest<T>) => Promise<R> {
  return async (req: CallableRequest<T>): Promise<R> => {
    const uid = req.auth?.uid
    // Emulator integration tests run unauthenticated; skip rate limiting
    // there so the test harness doesn't need to mint anon tokens.
    if (!uid) {
      if (process.env.FUNCTIONS_EMULATOR === 'true') return handler(req)
      throw new HttpsError('unauthenticated', 'auth required')
    }

    const ref = db.doc(`meta/rate_buckets/${uid}`)
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      const now = Date.now()
      const prev: BucketDoc = snap.exists
        ? (snap.data() as BucketDoc)
        : { tokens: CAPACITY, last_refill_at: now }
      const elapsedSec = Math.max(0, (now - prev.last_refill_at) / 1000)
      const refilled = Math.min(CAPACITY, prev.tokens + elapsedSec * REFILL_PER_SEC)
      if (refilled < 1) {
        throw new HttpsError('resource-exhausted', 'rate limited')
      }
      tx.set(ref, { tokens: refilled - 1, last_refill_at: now })
    })

    return handler(req)
  }
}
