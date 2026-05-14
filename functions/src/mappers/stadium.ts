// Pure mapper: FIFAStadium (upstream) → Venue (internal v2).
// Mirrors docs/plan/02-data-contracts.md § 3.2 and § 5.3.

import type { FIFAStadium } from '../upstream/types.js'
import type { Venue } from '../internal/types.js'

// Words that don't contribute to a deterministic abbreviation.
const NOISE_WORDS = new Set([
  'STADIUM',
  'ARENA',
  'PARK',
  'THE',
  'OF',
  'AND',
  'AT',
])

/**
 * Derive a stable 3-letter abbreviation from a venue name.
 *
 * Strategy: take the first letter of each "significant" word
 * (skipping NOISE_WORDS like "Stadium", "Arena", "Park", "The"),
 * uppercase, normalised to strip diacritics, then pad or truncate
 * to exactly 3 letters.
 *
 * If fewer than 3 significant words exist, pad with subsequent
 * letters from the first significant word.
 *
 * Collision handling is the caller's responsibility (deterministic
 * suffix `2`, `3`, … in upstream-id order via `dedupeVenueShorts`).
 */
export function deriveVenueShort(name: string): string {
  const cleaned = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9\s]/g, ' ')
  const words = cleaned
    .split(/\s+/)
    .map((w) => w.toUpperCase())
    .filter((w) => w.length > 0 && !NOISE_WORDS.has(w))
  if (words.length === 0) {
    // fall back to first 3 chars of the original name, stripped.
    const stripped = cleaned.replace(/\s+/g, '').toUpperCase()
    return (stripped + 'XXX').slice(0, 3)
  }
  // first letter of each significant word
  const initials = words.map((w) => w.charAt(0)).join('')
  if (initials.length >= 3) return initials.slice(0, 3)
  // need to pad — pull more letters from the first significant word
  const firstWord = words[0] ?? ''
  let out = initials
  let i = 1
  while (out.length < 3 && i < firstWord.length) {
    out += firstWord.charAt(i)
    i++
  }
  // pad with X if still short
  while (out.length < 3) out += 'X'
  return out.slice(0, 3)
}

/**
 * Deterministically deduplicate venue short codes by appending `2`, `3`, …
 * to collisions in upstream-id order. Returns a new array; does not mutate.
 *
 * Documented in docs/plan/02-data-contracts.md § 5.3.
 */
export function dedupeVenueShorts(venues: Venue[]): Venue[] {
  // sort by id ascending so the assignment is stable across runs
  const sorted = [...venues].sort((a, b) => a.id - b.id)
  const seen = new Map<string, number>()
  return sorted.map((v) => {
    const count = seen.get(v.short) ?? 0
    seen.set(v.short, count + 1)
    if (count === 0) return v
    // first collision gets a "2", second gets a "3", … keeping 3 chars total
    const suffix = String(count + 1)
    const base = v.short.slice(0, Math.max(1, 3 - suffix.length))
    return { ...v, short: (base + suffix).slice(0, 3) }
  })
}

/**
 * Pure mapper: upstream FIFAStadium → internal Venue.
 * Pass through identity-mappable fields and synthesise `short`.
 *
 * Note: collision-free `short` codes require running the result through
 * `dedupeVenueShorts` once the full venue set is available. A single-call
 * `mapStadium` returns the derived short verbatim.
 */
export function mapStadium(s: FIFAStadium): Venue {
  return {
    id: s.id,
    short: deriveVenueShort(s.name),
    name: s.name,
    city: s.city,
    country: s.country,
    capacity: s.capacity,
  }
}
