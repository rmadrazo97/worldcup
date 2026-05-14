// In-process per-key promise dedup. Coalesces concurrent calls for the
// same key into one upstream fetch within a single Function instance.
// Distributed dedup is intentionally out of scope (see
// docs/plan/03-backend-functions.md § 5 "Stampede protection").

const inflight = new Map<string, Promise<unknown>>()

export async function run<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key)
  if (existing) return existing as Promise<T>
  const p = fn().finally(() => {
    inflight.delete(key)
  })
  inflight.set(key, p)
  return p as Promise<T>
}

/** Test-only: clear the inflight map between cases. */
export function _resetForTests(): void {
  inflight.clear()
}
