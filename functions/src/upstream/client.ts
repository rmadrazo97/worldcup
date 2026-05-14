// The only module that calls fetch(). Everything else routes through
// `request<T>` / `paginate<T>`. Wires:
//   - raw-key Authorization (NOT Bearer) — verified 2026-05-14.
//   - 10 s timeout via AbortController.
//   - 1 retry on 5xx with 200–400 ms jitter.
//   - 429: read Retry-After (cap 2 s), single retry, then UpstreamRateLimited.
//   - error translation by status code.
//   - x-ratelimit-* header parsing → meta/upstream_budget (best-effort).
// Refer to docs/plan/03-backend-functions.md § 4.

import { FieldValue } from 'firebase-admin/firestore'
import { BALLDONTLIE_API_KEY, BASE_URL } from '../config.js'
import { db } from '../firebase.js'
import { logger } from '../util/logging.js'
import {
  TierRequiredError,
  UpstreamAuthError,
  UpstreamBadRequest,
  UpstreamError,
  UpstreamRateLimited,
  UpstreamServerError,
  UpstreamTimeout,
} from './errors.js'
import type { FIFAList } from './types.js'

const TIMEOUT_MS = 10_000
const RATE_LIMIT_MAX_WAIT_MS = 2_000

type QueryValue = string | number | string[] | number[] | undefined | null
export type Query = Record<string, QueryValue>

export interface RequestOpts {
  retryOn5xx?: boolean
  signal?: AbortSignal
}

export interface PaginateOpts extends RequestOpts {
  maxPages?: number
  perPage?: number
}

export interface UpstreamBudget {
  limit: number
  remaining: number
  resetAt: number
}

function readApiKey(): string {
  // BALLDONTLIE_API_KEY.value() throws if the secret isn't bound at
  // deploy time, so guard against that for emulator runs.
  let secret = ''
  try {
    secret = BALLDONTLIE_API_KEY.value()
  } catch {
    secret = ''
  }
  return secret || process.env.BALLDONTLIE_API_KEY || ''
}

function authHeaders(path: string): Record<string, string> {
  const key = readApiKey()
  if (!key) throw new UpstreamAuthError(path, 500, 'no api key configured')
  // Raw key — `Bearer <key>` also works upstream; raw is canonical.
  return { Authorization: key }
}

/**
 * Build a URL with PHP-style repeated `key[]=v` parameters for arrays.
 * Comma-CSV silently returns 0 rows from balldontlie — do not use it.
 */
export function buildUrl(base: string, q: Query): string {
  const usp = new URLSearchParams()
  for (const [k, v] of Object.entries(q)) {
    if (v == null) continue
    if (Array.isArray(v)) {
      for (const x of v) usp.append(`${k}[]`, String(x))
    } else {
      usp.set(k, String(v))
    }
  }
  const qs = usp.toString()
  return qs ? `${base}?${qs}` : base
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * Persist the latest upstream rate-limit budget. Best-effort: any error
 * (e.g. emulator without Firestore, transient Firestore failure) is
 * swallowed — this must never break the read path.
 */
export async function recordUpstreamBudget(b: UpstreamBudget): Promise<void> {
  try {
    await db.doc('meta/upstream_budget').set(
      {
        limit: b.limit,
        remaining: b.remaining,
        resetAt: b.resetAt,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
  } catch (err) {
    // Intentionally swallowed — log so we can see it but never throw.
    logger.warn('upstream.budget_write_failed', { err: String(err) })
  }
}

function parseBudgetHeaders(headers: Headers): UpstreamBudget | null {
  const limit = Number(headers.get('x-ratelimit-limit') ?? '')
  const remaining = Number(headers.get('x-ratelimit-remaining') ?? '')
  const resetSec = Number(headers.get('x-ratelimit-reset') ?? '')
  if (!Number.isFinite(limit) || !Number.isFinite(remaining) || !Number.isFinite(resetSec)) {
    return null
  }
  if (limit <= 0 && remaining <= 0 && resetSec <= 0) return null
  return { limit, remaining, resetAt: resetSec * 1000 }
}

export async function request<T>(
  path: string,
  query: Query = {},
  opts: RequestOpts = {},
): Promise<T> {
  const url = buildUrl(BASE_URL + path, query)
  const start = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  // External AbortSignal: chain by aborting our controller when it fires.
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort()
    else opts.signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  let attempt = 0
  try {
    // The retry loop: at most 2 iterations (initial + 1 retry on 5xx OR 429).
    // Other statuses break out immediately.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      attempt++
      let res: Response
      try {
        res = await fetch(url, {
          headers: authHeaders(path),
          signal: controller.signal,
        })
      } catch (err) {
        const name = (err as { name?: string }).name
        if (name === 'AbortError') {
          throw new UpstreamTimeout(path, Date.now() - start)
        }
        if (attempt === 1 && (opts.retryOn5xx ?? true)) {
          await sleep(200 + Math.random() * 200)
          continue
        }
        throw new UpstreamServerError(path, 0, String(err))
      }

      if (res.ok) {
        // Best-effort budget update — do not await; do not let failures escape.
        const budget = parseBudgetHeaders(res.headers)
        if (budget) {
          void recordUpstreamBudget(budget)
          if (budget.limit > 0 && budget.remaining < budget.limit * 0.1) {
            logger.warn('upstream.rate_low', budget)
          }
        }
        return (await res.json()) as T
      }

      if (res.status === 401) {
        throw new UpstreamAuthError(path, 401, await res.text())
      }
      if (res.status === 402 || res.status === 403) {
        throw new TierRequiredError(path, res.status)
      }
      if (res.status === 429) {
        if (attempt === 1) {
          const retryAfterSec = parseInt(res.headers.get('retry-after') ?? '1', 10) || 1
          const wait = Math.min(RATE_LIMIT_MAX_WAIT_MS, retryAfterSec * 1000)
          await sleep(wait)
          continue
        }
        const retryAfterSec = parseInt(res.headers.get('retry-after') ?? '1', 10) || 1
        throw new UpstreamRateLimited(path, retryAfterSec)
      }
      if (res.status >= 500) {
        if (attempt === 1 && (opts.retryOn5xx ?? true)) {
          await sleep(200 + Math.random() * 200)
          continue
        }
        throw new UpstreamServerError(path, res.status, await res.text())
      }
      // Any other 4xx
      throw new UpstreamBadRequest(path, res.status, await res.text())
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Walk `meta.next_cursor` up to `maxPages` (default 10). At per_page=100
 * that's 1000 rows — well above any realistic World Cup payload (~64
 * matches). A runaway loop logs and returns what it has.
 */
export async function paginate<T>(
  path: string,
  query: Query = {},
  opts: PaginateOpts = {},
): Promise<T[]> {
  const maxPages = opts.maxPages ?? 10
  const perPage = opts.perPage ?? 100
  const out: T[] = []
  let cursor: number | undefined

  for (let i = 0; i < maxPages; i++) {
    const pageQuery: Query = { ...query, per_page: perPage }
    if (cursor != null) pageQuery['cursor'] = cursor
    const page = await request<FIFAList<T>>(path, pageQuery, opts)
    out.push(...page.data)
    const next = page.meta?.next_cursor
    if (next == null) return out
    cursor = next
  }
  logger.warn('paginate.bounded', { path, maxPages, collected: out.length })
  return out
}

export { UpstreamError }
