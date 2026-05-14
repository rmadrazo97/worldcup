// Active-season resolver. Reads `?season=` from the URL, validates against
// the allow-list, and falls back to the default. Cheap to call every render.

const VALID = new Set([2018, 2022, 2026])
const DEFAULT_SEASON = Number(import.meta.env.VITE_DEFAULT_SEASON) || 2026

export function getActiveSeason() {
  if (typeof window === 'undefined') return DEFAULT_SEASON
  const usp = new URLSearchParams(window.location.search)
  const raw = usp.get('season')
  if (raw == null) return DEFAULT_SEASON
  const n = Number(raw)
  return VALID.has(n) ? n : DEFAULT_SEASON
}

export const ALL_SEASONS = [2018, 2022, 2026]
