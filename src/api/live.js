// Firestore listeners for live matches. The backend writes the cache docs at
// `matches/match_{id}` and `matchDetails/details_{id}` (matches the shared
// cache key convention in functions/src/cache/keys.ts). Each subscription
// returns an unsubscribe function.

import { doc, onSnapshot } from 'firebase/firestore'
import { getClient } from './client.js'

export function subscribeMatch(matchId, cb) {
  const { db } = getClient()
  const ref = doc(db, 'matches', `match_${matchId}`)
  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) { cb(null); return }
    const data = snap.data()
    const payload = data?.payload ?? null
    cb(payload)
  }, (err) => {
    console.warn('subscribeMatch error', err)
    cb(null)
  })
}

export function subscribeMatchDetails(matchId, cb) {
  const { db } = getClient()
  const ref = doc(db, 'matchDetails', `details_${matchId}`)
  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) { cb(null); return }
    cb(snap.data()?.payload ?? null)
  }, (err) => {
    console.warn('subscribeMatchDetails error', err)
    cb(null)
  })
}
