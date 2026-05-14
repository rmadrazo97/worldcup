// Thin wrapper around firebase-functions/logger. We re-export `logger`
// so callers don't need to import the framework directly, and provide a
// `logHandler` helper that emits the canonical structured-exit log line
// every handler is expected to write (see docs/plan/03-backend-functions.md
// § 10 "Observability").

import { logger } from 'firebase-functions'

export { logger }

export interface HandlerLogFields {
  handler: string
  cache_hit: boolean
  stale: boolean
  frozen: boolean
  tier_required: boolean
  upstream_ms: number
  total_ms: number
  status: 'ok' | 'error'
  [extra: string]: unknown
}

export function logHandler(name: string, fields: Omit<HandlerLogFields, 'handler'>): void {
  logger.info('handler.complete', { handler: name, ...fields })
}
