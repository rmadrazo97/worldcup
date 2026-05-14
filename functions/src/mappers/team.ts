// Pure mapper: FIFATeam (upstream) → Team (internal v2).
// Mirrors docs/plan/02-data-contracts.md § 3.1 and § 5.1–5.2.

import type { FIFATeam } from '../upstream/types.js'
import type { Team } from '../internal/types.js'
import {
  FLAG_OVERRIDES,
  ISO3_TO_ISO2,
  SHORT_OVERRIDES,
} from './team-overrides.js'

function deriveShort(t: FIFATeam): string {
  // 1) explicit override by upstream id
  const override = SHORT_OVERRIDES[t.id]
  if (override) return override
  // 2) upstream abbreviation if it looks usable (3 chars)
  const abbr = t.abbreviation?.trim()
  if (abbr && abbr.length === 3) return abbr.toUpperCase()
  // 3) derive from country_code first 3 chars
  const cc = t.country_code?.trim()
  if (cc && cc.length >= 3) return cc.slice(0, 3).toUpperCase()
  // 4) derive from name first 3 alpha chars
  const cleanName = t.name
    .normalize('NFD')
    // strip combining diacritics
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z]/g, '')
  return cleanName.slice(0, 3).toUpperCase()
}

function deriveCode(short: string, countryCode: string | null): string {
  // 1) UK home nations and similar — keyed by the team's `short` so we can
  // override ENG/SCO/WAL/NIR even when upstream country_code is generic.
  const flagOverride = FLAG_OVERRIDES[short]
  if (flagOverride) return flagOverride
  // 2) ISO3 → ISO2 lookup against the upstream country_code (uppercased).
  if (countryCode) {
    const upper = countryCode.toUpperCase()
    const iso2 = ISO3_TO_ISO2[upper]
    if (iso2) return iso2
    // 3) fall back to first 2 chars lowercased — for ISO-2 inputs this
    // is the identity; for unknown ISO-3 inputs it's a best-effort guess.
    return upper.slice(0, 2).toLowerCase()
  }
  return ''
}

/**
 * Pure mapper: upstream FIFATeam → internal Team.
 * No I/O, no side effects.
 */
export function mapTeam(t: FIFATeam): Team {
  const short = deriveShort(t)
  const code = deriveCode(short, t.country_code)
  return {
    id: t.id,
    short,
    name: t.name,
    code,
    confederation: t.confederation,
  }
}
