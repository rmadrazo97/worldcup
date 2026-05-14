import { defineSecret } from 'firebase-functions/params'
import { setGlobalOptions } from 'firebase-functions/v2'
import type { HttpsOptions } from 'firebase-functions/v2/https'

export const REGION = 'us-central1'
export const BASE_URL = 'https://api.balldontlie.io/fifa/worldcup/v1'

setGlobalOptions({ region: REGION, maxInstances: 50 })

export const BALLDONTLIE_API_KEY = defineSecret('BALLDONTLIE_API_KEY')

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
