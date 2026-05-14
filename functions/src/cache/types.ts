import type { Timestamp } from 'firebase-admin/firestore'

export interface CachedDoc<T> {
  payload: T
  _fetchedAt: Timestamp
  _expiresAt: Timestamp
  _schema: 'v2'
  _source: 'upstream' | 'stale-fallback' | 'scheduler'
  _frozen?: boolean
  _frozenAt?: Timestamp
  _frozenReason?: 'match-ft-grace' | 'season-complete' | 'manual'
  _tierRequired?: boolean
}

export interface CacheReadResult<T> {
  value: T
  cacheHit: boolean
  stale: boolean
  frozen: boolean
}
