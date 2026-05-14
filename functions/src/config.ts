import { defineSecret } from 'firebase-functions/params'
import { setGlobalOptions } from 'firebase-functions/v2'
import type { HttpsOptions } from 'firebase-functions/v2/https'

// Re-derive the SecretParam return type without referencing the internal
// firebase-functions path that TS' isolatedDeclarations flags as
// non-portable. ReturnType<typeof defineSecret> keeps the binding fully
// typed while only depending on the public API.
type Secret = ReturnType<typeof defineSecret>

export const REGION = 'us-central1'
export const BASE_URL = 'https://api.balldontlie.io/fifa/worldcup/v1'

setGlobalOptions({ region: REGION, maxInstances: 50 })

export const BALLDONTLIE_API_KEY: Secret = defineSecret('BALLDONTLIE_API_KEY')

export const LIGHT_READ: Partial<HttpsOptions> = {
  memory: '256MiB',
  timeoutSeconds: 30,
  concurrency: 80,
}

export const HEAVY_READ: Partial<HttpsOptions> = {
  memory: '256MiB',
  timeoutSeconds: 60,
  concurrency: 80,
  minInstances: 1,
}

export const COMPOSITE: Partial<HttpsOptions> = {
  memory: '512MiB',
  timeoutSeconds: 60,
  concurrency: 40,
  minInstances: 1,
}

export const SCHEDULER = {
  memory: '512MiB' as const,
  timeoutSeconds: 540,
}
