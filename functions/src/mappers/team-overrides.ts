// Hardcoded override tables for the team mapper.
//
// Two cases the upstream can't answer for us:
//   1. flagcdn code overrides — UK home nations need GB-region subcodes
//      (`gb-eng`, `gb-sct`, etc.) so the flag renders correctly.
//   2. ISO-3 → ISO-2 mapping for `country_code`, because flagcdn expects
//      ISO-3166-1 alpha-2 codes (e.g. "br", "ar"), but the upstream
//      `country_code` is typically alpha-3 ("BRA", "ARG"). The mapper
//      derives `code` by looking up `country_code.toUpperCase()` in this
//      table, falling back to `country_code.slice(0,2).toLowerCase()`.
//
// Keys are *uppercase* ISO-3 / FIFA-3 codes. Values are *lowercase*
// flagcdn codes. The seed list covers every team in the captured
// `teams_2022.json` and `teams_2026.json` fixtures.

/**
 * Override the flagcdn `code` based on the team's 3-letter `short`.
 * UK home nations share `country_code: "GB"` (or use FIFA codes ENG/SCO/WAL/NIR)
 * upstream, but flagcdn distinguishes them via subdivision codes.
 */
export const FLAG_OVERRIDES: Record<string, string> = {
  ENG: 'gb-eng',
  SCO: 'gb-sct',
  WAL: 'gb-wls',
  NIR: 'gb-nir',
}

/**
 * Override the 3-letter `short` for a team by upstream id.
 * Empty today — populated if upstream `abbreviation` is missing/wrong
 * for a specific team id.
 */
export const SHORT_OVERRIDES: Record<number, string> = {}

/**
 * Map an upstream alpha-3 / FIFA-3 country code to a flagcdn alpha-2 code.
 * Covers every team in the captured 2022 and 2026 fixtures.
 *
 * Note: FIFA codes are not always ISO-3 (e.g. "GER" not "DEU", "POR" not "PRT");
 * this table treats them by the upstream wire value, not by ISO purity.
 */
export const ISO3_TO_ISO2: Record<string, string> = {
  // 2022 fixture
  ARG: 'ar',
  AUS: 'au',
  BEL: 'be',
  BRA: 'br',
  CMR: 'cm',
  CAN: 'ca',
  CRI: 'cr',
  CRO: 'hr',
  DNK: 'dk',
  ECU: 'ec',
  ENG: 'gb-eng',
  FRA: 'fr',
  GER: 'de',
  GHA: 'gh',
  IRN: 'ir',
  JPN: 'jp',
  MEX: 'mx',
  MAR: 'ma',
  NED: 'nl',
  POL: 'pl',
  POR: 'pt',
  QAT: 'qa',
  KSA: 'sa',
  SEN: 'sn',
  SRB: 'rs',
  KOR: 'kr',
  ESP: 'es',
  SUI: 'ch',
  TUN: 'tn',
  URU: 'uy',
  USA: 'us',
  WAL: 'gb-wls',
  // 2026 fixture additions
  ALG: 'dz',
  AUT: 'at',
  BIH: 'ba',
  CPV: 'cv',
  COL: 'co',
  CIV: 'ci',
  CUW: 'cw',
  CZE: 'cz',
  COD: 'cd',
  EGY: 'eg',
  HAI: 'ht',
  IRQ: 'iq',
  JOR: 'jo',
  NZL: 'nz',
  NOR: 'no',
  PAN: 'pa',
  PAR: 'py',
  SCO: 'gb-sct',
  RSA: 'za',
  SWE: 'se',
  TUR: 'tr',
  UZB: 'uz',
}
