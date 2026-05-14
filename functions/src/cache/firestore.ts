// Generic cache-aside with TTL + freeze + stale-on-error. The single
// source of truth for read-through caching in this codebase. Handlers
// MUST go through `getOrSet`; schedulers MAY use `writeThrough`.
//
// Contract (mirrors docs/plan/03-backend-functions.md § 5):
//   1. _frozen short-circuit BEFORE TTL check — never calls freshFn.
//   2. Fresh cache hit (now < _expiresAt) → return as cacheHit.
//   3. Miss / expired → acquire per-key mutex, re-check, then freshFn.
//   4. freshFn throws and a previous doc exists → return stale, log.
//   5. freshFn throws and no doc exists → propagate.
//   6. writeThrough preserves _frozen if it was already true.

import { FieldValue, Timestamp, type DocumentReference } from 'firebase-admin/firestore'
import { db } from '../firebase.js'
import type { CachedDoc, CacheReadResult } from './types.js'
import { FROZEN_EXPIRES_AT_MS } from '../util/ttl.js'
import { logger } from '../util/logging.js'
import * as mutex from './mutex.js'

type FreezeReason = 'match-ft-grace' | 'season-complete' | 'manual'

export async function getOrSet<T>(
  collection: string,
  docId: string,
  ttlSeconds: number,
  freshFn: () => Promise<T>,
): Promise<CacheReadResult<T>> {
  const ref = db.collection(collection).doc(docId)
  const snap = await ref.get()
  const now = Date.now()

  if (snap.exists) {
    const doc = snap.data() as CachedDoc<T> | undefined
    if (doc) {
      // Freeze short-circuit: archived seasons / late-grace FT matches
      // never refetch upstream, even if _expiresAt is in the past.
      if (doc._frozen === true) {
        return { value: doc.payload, cacheHit: true, stale: false, frozen: true }
      }
      if (doc._expiresAt && doc._expiresAt.toMillis() > now) {
        return { value: doc.payload, cacheHit: true, stale: false, frozen: false }
      }
    }
  }

  return mutex.run(`${collection}/${docId}`, async (): Promise<CacheReadResult<T>> => {
    // Re-check under the lock — another concurrent request on the same
    // instance may have populated the doc while we awaited the lock.
    const snap2 = await ref.get()
    const doc2 = snap2.exists ? (snap2.data() as CachedDoc<T> | undefined) : undefined
    if (doc2?._frozen === true) {
      return { value: doc2.payload, cacheHit: true, stale: false, frozen: true }
    }
    if (doc2 && doc2._expiresAt && doc2._expiresAt.toMillis() > now) {
      return { value: doc2.payload, cacheHit: true, stale: false, frozen: false }
    }

    try {
      const fresh = await freshFn()
      const expiresAt = Timestamp.fromMillis(now + ttlSeconds * 1000)
      // We're guaranteed here that doc2 (if any) had _frozen !== true —
      // the early return above would have short-circuited otherwise. So
      // a plain write-through cannot accidentally unfreeze.
      const out: CachedDoc<T> = {
        payload: fresh,
        _fetchedAt: Timestamp.fromMillis(now),
        _expiresAt: expiresAt,
        _schema: 'v2',
        _source: 'upstream',
      }
      await ref.set(out)
      return { value: fresh, cacheHit: false, stale: false, frozen: false }
    } catch (err) {
      if (doc2) {
        logger.warn('cache.stale_fallback', {
          collection,
          docId,
          err: String(err),
        })
        return { value: doc2.payload, cacheHit: true, stale: true, frozen: false }
      }
      throw err
    }
  })
}

/**
 * Forced write of a known-good payload. Used by schedulers and by
 * fan-out write-through after getMatches. Preserves _frozen if it was
 * already true so we never accidentally unfreeze.
 */
export async function writeThrough<T>(
  collection: string,
  docId: string,
  ttlSeconds: number,
  payload: T,
  source: CachedDoc<T>['_source'] = 'upstream',
): Promise<void> {
  const ref = db.collection(collection).doc(docId)
  const now = Date.now()
  const snap = await ref.get()
  const existing = snap.exists ? (snap.data() as CachedDoc<T> | undefined) : undefined

  const doc: CachedDoc<T> = {
    payload,
    _fetchedAt: Timestamp.fromMillis(now),
    _expiresAt: Timestamp.fromMillis(now + ttlSeconds * 1000),
    _schema: 'v2',
    _source: source,
  }
  if (existing?._frozen === true) {
    doc._frozen = true
    if (existing._frozenAt) doc._frozenAt = existing._frozenAt
    if (existing._frozenReason) doc._frozenReason = existing._frozenReason
  }
  await ref.set(doc)
}

/**
 * Mark an existing doc as frozen. Bumps `_expiresAt` to the year-9999
 * sentinel so Firestore's native TTL policy never evicts it, and
 * records `_frozenAt` + `_frozenReason`. Reference is passed in so the
 * caller decides which collection / id to freeze.
 */
export async function setFrozen(
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
