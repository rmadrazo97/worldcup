// Deep-clone a payload, dropping every key that starts with "_".
// Used at the response boundary so cache plumbing (`_fetchedAt`,
// `_expiresAt`, `_frozen`, `_source`, `_schema`, ...) never leaks to the
// client.

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== 'object') return false
  const proto = Object.getPrototypeOf(v)
  return proto === Object.prototype || proto === null
}

export function stripInternal<T>(payload: T): T {
  return walk(payload) as T
}

function walk(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(walk)
  if (isPlainObject(v)) {
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v)) {
      if (k.startsWith('_')) continue
      out[k] = walk(val)
    }
    return out
  }
  // primitives, Date, Timestamp, etc. — return as-is. The contract is
  // "strip _-prefixed keys from plain objects/arrays"; non-plain values
  // (e.g. firestore Timestamp instances) shouldn't appear in payloads
  // we sanitize, but if they do we hand them back untouched.
  return v
}
