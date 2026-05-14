// Test helper that swaps the global `fetch` so the upstream client
// returns canned responses. `mockUpstream({ "/teams": new Response(...) })`
// matches by suffix on the request URL (after the query string is
// stripped) so callers don't have to spell out BASE_URL.

import { afterEach, vi } from 'vitest'

type ResponseFactory = Response | (() => Response | Promise<Response>)

interface MockState {
  map: Map<string, ResponseFactory[]>
  fallthrough?: ResponseFactory
}

const state: MockState = { map: new Map() }

function pathOf(url: string): string {
  try {
    const u = new URL(url)
    return u.pathname
  } catch {
    return url.split('?')[0] ?? url
  }
}

function asResponse(r: ResponseFactory): Response | Promise<Response> {
  return typeof r === 'function' ? r() : r.clone()
}

export interface MockUpstreamOptions {
  /** If a request path doesn't match any key, fall through to this. */
  fallthrough?: ResponseFactory
}

/**
 * Install a stubbed global fetch. The `map` is keyed by upstream path
 * (e.g. "/teams"); values are a single Response or an ordered list of
 * Responses (for pagination / retry tests, each call pops the next one).
 */
export function mockUpstream(
  map: Record<string, ResponseFactory | ResponseFactory[]>,
  opts: MockUpstreamOptions = {},
): {
  fetchSpy: ReturnType<typeof vi.fn>
  calls: () => string[]
} {
  state.map.clear()
  for (const [k, v] of Object.entries(map)) {
    state.map.set(k, Array.isArray(v) ? [...v] : [v])
  }
  state.fallthrough = opts.fallthrough

  const calls: string[] = []
  const fetchSpy = vi.fn(async (input: unknown): Promise<Response> => {
    const url = typeof input === 'string'
      ? input
      : (input as { url?: string }).url ?? String(input)
    calls.push(url)
    const path = pathOf(url)
    // Find the longest matching suffix.
    let best: { key: string; factories: ResponseFactory[] } | null = null
    for (const [k, factories] of state.map.entries()) {
      if (path === k || path.endsWith(k)) {
        if (!best || k.length > best.key.length) best = { key: k, factories }
      }
    }
    if (best && best.factories.length > 0) {
      const next = best.factories.shift()!
      return asResponse(next)
    }
    if (state.fallthrough) return asResponse(state.fallthrough)
    return new Response('not stubbed: ' + path, { status: 599 })
  })

  // Cast through unknown to avoid the global-fetch typing dance.
  globalThis.fetch = fetchSpy as unknown as typeof fetch

  return { fetchSpy, calls: () => [...calls] }
}

/** Restore native fetch and clear the stub map. */
export function restoreUpstream(): void {
  state.map.clear()
  state.fallthrough = undefined
  vi.unstubAllGlobals?.()
}

// Auto-cleanup between tests so a forgotten reset can't leak state.
afterEach(() => {
  restoreUpstream()
})

/** Helper: JSON response with optional headers / status. */
export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json', ...(init.headers as Record<string, string>) },
    ...init,
  })
}
