// Lightweight liveness probe. No App Check, no auth, no upstream — used by
// the load balancer / external monitors. CORS open so a browser fetch from
// the UI can also confirm the deployment is alive.

import { onRequest } from 'firebase-functions/v2/https'
import { LIGHT_READ } from '../config.js'

export const health = onRequest({ ...LIGHT_READ, cors: true }, (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() })
})
