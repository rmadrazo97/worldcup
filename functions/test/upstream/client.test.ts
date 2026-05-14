import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { jsonResponse, mockUpstream } from '../helpers/stubUpstream.js'

// Set BEFORE importing the client. The client's readApiKey() falls
// through to process.env when BALLDONTLIE_API_KEY.value() returns "".
process.env.BALLDONTLIE_API_KEY = 'test-key'

// Silence the budget write — Firestore isn't available in unit tests.
// vi.mock is hoisted by vitest so this applies before the imports below.
vi.mock('../../src/firebase.js', () => ({
  db: {
    doc: () => ({ set: async () => undefined }),
    collection: () => ({
      doc: () => ({ set: async () => undefined, get: async () => ({ exists: false }) }),
    }),
    runTransaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
  },
}))

import { request, paginate, buildUrl } from '../../src/upstream/client.js'
import {
  UpstreamAuthError,
  TierRequiredError,
  UpstreamRateLimited,
  UpstreamServerError,
  UpstreamBadRequest,
  UpstreamTimeout,
} from '../../src/upstream/errors.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const teamsFixture = JSON.parse(
  readFileSync(join(__dirname, '../fixtures/upstream/teams_2022.json'), 'utf-8'),
) as { data: Array<{ id: number; name: string }> }

describe('upstream/client', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('buildUrl', () => {
    it('expands arrays into PHP-style repeated key[]=v params', () => {
      const url = buildUrl('https://x.test/teams', { 'seasons': [2018, 2022] })
      // URLSearchParams encodes "[]" as "%5B%5D"
      expect(url).toContain('seasons%5B%5D=2018')
      expect(url).toContain('seasons%5B%5D=2022')
    })
    it('skips null/undefined values', () => {
      const url = buildUrl('https://x.test/teams', { a: 1, b: null, c: undefined })
      expect(url).toContain('a=1')
      expect(url).not.toContain('b=')
      expect(url).not.toContain('c=')
    })
    it('omits query string when empty', () => {
      expect(buildUrl('https://x.test/teams', {})).toBe('https://x.test/teams')
    })
  })

  describe('request<T>', () => {
    it('returns JSON on 200', async () => {
      mockUpstream({ '/teams': jsonResponse(teamsFixture) })
      const out = await request<{ data: unknown[] }>('/teams', { 'seasons': [2022] })
      expect(out.data.length).toBe(teamsFixture.data.length)
    })

    it('throws UpstreamAuthError on 401', async () => {
      mockUpstream({ '/teams': new Response('bad key', { status: 401 }) })
      await expect(request('/teams')).rejects.toBeInstanceOf(UpstreamAuthError)
    })

    it('throws TierRequiredError on 402', async () => {
      mockUpstream({ '/teams': new Response('tier required', { status: 402 }) })
      await expect(request('/teams')).rejects.toBeInstanceOf(TierRequiredError)
    })

    it('throws TierRequiredError on 403', async () => {
      mockUpstream({ '/teams': new Response('forbidden', { status: 403 }) })
      await expect(request('/teams')).rejects.toBeInstanceOf(TierRequiredError)
    })

    it('throws UpstreamBadRequest on 4xx other than 401/402/403/429', async () => {
      mockUpstream({ '/teams': new Response('bad', { status: 400 }) })
      await expect(request('/teams')).rejects.toBeInstanceOf(UpstreamBadRequest)
    })

    it('429 retries once with Retry-After then throws UpstreamRateLimited', async () => {
      const { fetchSpy } = mockUpstream({
        '/teams': [
          new Response('throttled', { status: 429, headers: { 'retry-after': '0' } }),
          new Response('throttled', { status: 429, headers: { 'retry-after': '0' } }),
        ],
      })
      await expect(request('/teams')).rejects.toBeInstanceOf(UpstreamRateLimited)
      expect(fetchSpy).toHaveBeenCalledTimes(2)
    })

    it('5xx retries once with backoff then succeeds', async () => {
      const { fetchSpy } = mockUpstream({
        '/teams': [
          new Response('boom', { status: 500 }),
          jsonResponse(teamsFixture),
        ],
      })
      const out = await request<{ data: unknown[] }>('/teams')
      expect(out.data.length).toBe(teamsFixture.data.length)
      expect(fetchSpy).toHaveBeenCalledTimes(2)
    })

    it('5xx exhausted throws UpstreamServerError', async () => {
      mockUpstream({
        '/teams': [
          new Response('boom', { status: 500 }),
          new Response('boom', { status: 500 }),
        ],
      })
      await expect(request('/teams')).rejects.toBeInstanceOf(UpstreamServerError)
    })

    it('timeout yields UpstreamTimeout', async () => {
      // Mock fetch that never resolves until we abort.
      globalThis.fetch = (async (_url: unknown, init?: { signal?: AbortSignal }) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const e = new Error('aborted')
            ;(e as { name?: string }).name = 'AbortError'
            reject(e)
          })
        })
      }) as unknown as typeof fetch

      vi.useFakeTimers()
      const promise = request('/teams', {}, { retryOn5xx: false })
      // Advance past the 10 s default timeout.
      await vi.advanceTimersByTimeAsync(11_000)
      await expect(promise).rejects.toBeInstanceOf(UpstreamTimeout)
      vi.useRealTimers()
    })

    it('records upstream budget on 200 (best-effort)', async () => {
      // Should not throw even with no Firestore.
      mockUpstream({
        '/teams': jsonResponse(teamsFixture, {
          headers: {
            'x-ratelimit-limit': '600',
            'x-ratelimit-remaining': '599',
            'x-ratelimit-reset': '1700000000',
          },
        }),
      })
      await expect(request('/teams')).resolves.toBeDefined()
    })
  })

  describe('paginate<T>', () => {
    it('walks 3 pages via next_cursor', async () => {
      const page = (cursor: number | null, ids: number[]) =>
        jsonResponse({
          data: ids.map((id) => ({ id })),
          meta: { next_cursor: cursor, per_page: 100 },
        })
      mockUpstream({
        '/matches': [
          page(2, [1, 2, 3]),
          page(3, [4, 5, 6]),
          page(null, [7, 8]),
        ],
      })
      const out = await paginate<{ id: number }>('/matches')
      expect(out.map((r) => r.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    })

    it('honors 10-page cap and returns what it has', async () => {
      const factories = Array.from({ length: 12 }, (_, i) =>
        jsonResponse({
          data: [{ id: i }],
          meta: { next_cursor: i + 1, per_page: 100 },
        }),
      )
      const { fetchSpy } = mockUpstream({ '/matches': factories })
      const out = await paginate<{ id: number }>('/matches', {}, { maxPages: 10 })
      expect(out.length).toBe(10)
      expect(fetchSpy).toHaveBeenCalledTimes(10)
    })
  })
})
