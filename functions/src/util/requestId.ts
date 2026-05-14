// Request id extraction / minting. Callable requests expose the raw HTTP
// request via `rawRequest`; callers from internal code may not have one,
// so we fall back to a short minted id.

import type { CallableRequest } from 'firebase-functions/v2/https'

type WithRawRequest = {
  rawRequest?: { headers?: Record<string, string | string[] | undefined> }
}

function mintRid(): string {
  // 9 hex chars (~36 bits) — collision-free enough for a single log line.
  const hex = Math.floor(Math.random() * 0xffffffffff).toString(16)
  return `req_${hex.padStart(9, '0').slice(0, 9)}`
}

export function rid(req: CallableRequest<unknown> | WithRawRequest): string {
  const headers = (req as WithRawRequest).rawRequest?.headers
  const raw = headers?.['x-request-id']
  if (typeof raw === 'string' && raw.length > 0) return raw
  if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'string') return raw[0]
  return mintRid()
}
