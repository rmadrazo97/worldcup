// 2026 FIFA World Cup — groups, teams, matches.
// Group draw is real (Wikipedia, Dec 5 2025 draw at Kennedy Center).
// Scores are simulated — we're pretending it's mid-tournament,
// Friday June 19, 2026, ~16:30 ET.
//
// Matchday 1 (Jun 11–17): all complete with mock results.
// Matchday 2 (Jun 18–23):
//   Groups A, B = complete (played Jun 18)
//   Groups C, D = in progress today (Jun 19) — some live, some upcoming
//   Groups E–L = upcoming on later dates
// Matchday 3 (Jun 24–27): not started.

export const NOW = "Fri, Jun 19 · 4:31 PM ET";

// ISO country codes for flagcdn (https://flagcdn.com/w80/<code>.png)
export const TEAMS = {
  MEX: { name: "Mexico",            code: "mx",     short: "MEX" },
  ZAF: { name: "South Africa",      code: "za",     short: "RSA" },
  KOR: { name: "South Korea",       code: "kr",     short: "KOR" },
  CZE: { name: "Czech Republic",    code: "cz",     short: "CZE" },

  CAN: { name: "Canada",            code: "ca",     short: "CAN" },
  BIH: { name: "Bosnia & H.",       code: "ba",     short: "BIH" },
  QAT: { name: "Qatar",             code: "qa",     short: "QAT" },
  SUI: { name: "Switzerland",       code: "ch",     short: "SUI" },

  BRA: { name: "Brazil",            code: "br",     short: "BRA" },
  MAR: { name: "Morocco",           code: "ma",     short: "MAR" },
  HAI: { name: "Haiti",             code: "ht",     short: "HAI" },
  SCO: { name: "Scotland",          code: "gb-sct", short: "SCO" },

  USA: { name: "United States",     code: "us",     short: "USA" },
  PAR: { name: "Paraguay",          code: "py",     short: "PAR" },
  AUS: { name: "Australia",         code: "au",     short: "AUS" },
  TUR: { name: "Türkiye",           code: "tr",     short: "TUR" },

  GER: { name: "Germany",           code: "de",     short: "GER" },
  CUW: { name: "Curaçao",           code: "cw",     short: "CUW" },
  CIV: { name: "Ivory Coast",       code: "ci",     short: "CIV" },
  ECU: { name: "Ecuador",           code: "ec",     short: "ECU" },

  NED: { name: "Netherlands",       code: "nl",     short: "NED" },
  JPN: { name: "Japan",             code: "jp",     short: "JPN" },
  SWE: { name: "Sweden",            code: "se",     short: "SWE" },
  TUN: { name: "Tunisia",           code: "tn",     short: "TUN" },

  BEL: { name: "Belgium",           code: "be",     short: "BEL" },
  EGY: { name: "Egypt",             code: "eg",     short: "EGY" },
  IRN: { name: "Iran",              code: "ir",     short: "IRN" },
  NZL: { name: "New Zealand",       code: "nz",     short: "NZL" },

  ESP: { name: "Spain",             code: "es",     short: "ESP" },
  CPV: { name: "Cape Verde",        code: "cv",     short: "CPV" },
  KSA: { name: "Saudi Arabia",      code: "sa",     short: "KSA" },
  URU: { name: "Uruguay",           code: "uy",     short: "URU" },

  FRA: { name: "France",            code: "fr",     short: "FRA" },
  SEN: { name: "Senegal",           code: "sn",     short: "SEN" },
  IRQ: { name: "Iraq",              code: "iq",     short: "IRQ" },
  NOR: { name: "Norway",            code: "no",     short: "NOR" },

  ARG: { name: "Argentina",         code: "ar",     short: "ARG" },
  ALG: { name: "Algeria",           code: "dz",     short: "ALG" },
  AUT: { name: "Austria",           code: "at",     short: "AUT" },
  JOR: { name: "Jordan",            code: "jo",     short: "JOR" },

  POR: { name: "Portugal",          code: "pt",     short: "POR" },
  COD: { name: "DR Congo",          code: "cd",     short: "COD" },
  UZB: { name: "Uzbekistan",        code: "uz",     short: "UZB" },
  COL: { name: "Colombia",          code: "co",     short: "COL" },

  ENG: { name: "England",           code: "gb-eng", short: "ENG" },
  CRO: { name: "Croatia",           code: "hr",     short: "CRO" },
  GHA: { name: "Ghana",             code: "gh",     short: "GHA" },
  PAN: { name: "Panama",            code: "pa",     short: "PAN" },
};

// Group composition (from the Dec 5 2025 draw).
export const GROUPS = [
  { id: "A", host: "Mexico",  teams: ["MEX","ZAF","KOR","CZE"] },
  { id: "B", host: "Canada",  teams: ["CAN","BIH","QAT","SUI"] },
  { id: "C", host: null,      teams: ["BRA","MAR","HAI","SCO"] },
  { id: "D", host: "USA",     teams: ["USA","PAR","AUS","TUR"] },
  { id: "E", host: null,      teams: ["GER","CUW","CIV","ECU"] },
  { id: "F", host: null,      teams: ["NED","JPN","SWE","TUN"] },
  { id: "G", host: null,      teams: ["BEL","EGY","IRN","NZL"] },
  { id: "H", host: null,      teams: ["ESP","CPV","KSA","URU"] },
  { id: "I", host: null,      teams: ["FRA","SEN","IRQ","NOR"] },
  { id: "J", host: null,      teams: ["ARG","ALG","AUT","JOR"] },
  { id: "K", host: null,      teams: ["POR","COD","UZB","COL"] },
  { id: "L", host: null,      teams: ["ENG","CRO","GHA","PAN"] },
];

// Stadiums (alternate FIFA names, abbreviated)
export const VENUES = {
  AZT: "Mexico City Stadium",
  BMO: "Toronto Stadium",
  ATL: "Atlanta Stadium",
  DAL: "Dallas Stadium",
  SFO: "SF Bay Area Stadium",
  LA:  "Los Angeles Stadium",
  HOU: "Houston Stadium",
  KC:  "Kansas City Stadium",
  PHI: "Philadelphia Stadium",
  SEA: "Seattle Stadium",
  BOS: "Boston Stadium",
  MIA: "Miami Stadium",
  NYC: "New York New Jersey Stadium",
  GDL: "Estadio Guadalajara",
  MTY: "Estadio Monterrey",
  BC:  "BC Place Vancouver",
};

// Each group has 6 matches over 3 matchdays:
//   MD1: 1v2, 3v4
//   MD2: 1v3, 4v2
//   MD3: 4v1, 2v3
//
// Match status: 'FT' final, 'LIVE' in progress (with minute), 'HT' half time,
// 'SCHED' upcoming (with kickoff time string).
//
// As of June 19, 2026 16:31 ET: MD1 done everywhere, MD2 done for A&B,
// MD2 today for C&D (some live + upcoming), MD2 scheduled for E–L.

export const MATCHES = [
  // ─────────── GROUP A (MD2 done June 18) ───────────
  { id: "A1-1", group: "A", md: 1, date: "Jun 11", home: "MEX", away: "ZAF", hs: 2, as: 1, status: "FT", venue: "AZT", kickoff: "8:00 PM CT" },
  { id: "A1-2", group: "A", md: 1, date: "Jun 11", home: "KOR", away: "CZE", hs: 1, as: 1, status: "FT", venue: "GDL", kickoff: "5:00 PM CT" },
  { id: "A2-1", group: "A", md: 2, date: "Jun 18", home: "MEX", away: "KOR", hs: 3, as: 2, status: "FT", venue: "MTY", kickoff: "5:00 PM CT" },
  { id: "A2-2", group: "A", md: 2, date: "Jun 18", home: "CZE", away: "ZAF", hs: 0, as: 0, status: "FT", venue: "GDL", kickoff: "2:00 PM CT" },
  { id: "A3-1", group: "A", md: 3, date: "Jun 24", home: "CZE", away: "MEX", status: "SCHED", venue: "AZT", kickoff: "11:00 AM CT" },
  { id: "A3-2", group: "A", md: 3, date: "Jun 24", home: "ZAF", away: "KOR", status: "SCHED", venue: "MTY", kickoff: "11:00 AM CT" },

  // ─────────── GROUP B (MD2 done June 18) ───────────
  { id: "B1-1", group: "B", md: 1, date: "Jun 12", home: "CAN", away: "BIH", hs: 1, as: 0, status: "FT", venue: "BMO", kickoff: "6:00 PM ET" },
  { id: "B1-2", group: "B", md: 1, date: "Jun 13", home: "QAT", away: "SUI", hs: 0, as: 2, status: "FT", venue: "BC",  kickoff: "3:00 PM PT" },
  { id: "B2-1", group: "B", md: 2, date: "Jun 18", home: "CAN", away: "QAT", hs: 2, as: 1, status: "FT", venue: "BMO", kickoff: "6:00 PM ET" },
  { id: "B2-2", group: "B", md: 2, date: "Jun 18", home: "SUI", away: "BIH", hs: 1, as: 1, status: "FT", venue: "BC",  kickoff: "12:00 PM PT" },
  { id: "B3-1", group: "B", md: 3, date: "Jun 24", home: "SUI", away: "CAN", status: "SCHED", venue: "BC",  kickoff: "5:00 PM PT" },
  { id: "B3-2", group: "B", md: 3, date: "Jun 24", home: "BIH", away: "QAT", status: "SCHED", venue: "BMO", kickoff: "5:00 PM ET" },

  // ─────────── GROUP C (MD2 TODAY, June 19) ───────────
  { id: "C1-1", group: "C", md: 1, date: "Jun 13", home: "BRA", away: "MAR", hs: 3, as: 0, status: "FT", venue: "LA",  kickoff: "3:00 PM PT" },
  { id: "C1-2", group: "C", md: 1, date: "Jun 13", home: "HAI", away: "SCO", hs: 0, as: 1, status: "FT", venue: "ATL", kickoff: "12:00 PM ET" },
  // LIVE NOW
  { id: "C2-1", group: "C", md: 2, date: "Jun 19", home: "BRA", away: "HAI", hs: 2, as: 0, status: "LIVE", minute: "67'", venue: "MIA", kickoff: "3:00 PM ET" },
  // UPCOMING TODAY
  { id: "C2-2", group: "C", md: 2, date: "Jun 19", home: "SCO", away: "MAR", status: "SCHED", venue: "SEA", kickoff: "6:00 PM PT" },
  { id: "C3-1", group: "C", md: 3, date: "Jun 25", home: "SCO", away: "BRA", status: "SCHED", venue: "LA",  kickoff: "12:00 PM PT" },
  { id: "C3-2", group: "C", md: 3, date: "Jun 25", home: "MAR", away: "HAI", status: "SCHED", venue: "ATL", kickoff: "12:00 PM ET" },

  // ─────────── GROUP D (MD2 TODAY, June 19) ───────────
  { id: "D1-1", group: "D", md: 1, date: "Jun 12", home: "USA", away: "PAR", hs: 2, as: 1, status: "FT", venue: "LA",  kickoff: "3:00 PM PT" },
  { id: "D1-2", group: "D", md: 1, date: "Jun 13", home: "AUS", away: "TUR", hs: 0, as: 2, status: "FT", venue: "PHI", kickoff: "3:00 PM ET" },
  // LIVE NOW (just kicked off)
  { id: "D2-1", group: "D", md: 2, date: "Jun 19", home: "USA", away: "AUS", hs: 1, as: 0, status: "LIVE", minute: "23'", venue: "LA", kickoff: "1:00 PM PT" },
  // UPCOMING TODAY
  { id: "D2-2", group: "D", md: 2, date: "Jun 19", home: "TUR", away: "PAR", status: "SCHED", venue: "BOS", kickoff: "8:00 PM ET" },
  { id: "D3-1", group: "D", md: 3, date: "Jun 25", home: "TUR", away: "USA", status: "SCHED", venue: "DAL", kickoff: "8:00 PM CT" },
  { id: "D3-2", group: "D", md: 3, date: "Jun 25", home: "PAR", away: "AUS", status: "SCHED", venue: "PHI", kickoff: "8:00 PM ET" },

  // ─────────── GROUP E (MD1 done, MD2 tomorrow) ───────────
  { id: "E1-1", group: "E", md: 1, date: "Jun 14", home: "GER", away: "CUW", hs: 4, as: 0, status: "FT", venue: "DAL", kickoff: "3:00 PM CT" },
  { id: "E1-2", group: "E", md: 1, date: "Jun 14", home: "CIV", away: "ECU", hs: 1, as: 0, status: "FT", venue: "KC",  kickoff: "12:00 PM CT" },
  { id: "E2-1", group: "E", md: 2, date: "Jun 20", home: "GER", away: "CIV", status: "SCHED", venue: "HOU", kickoff: "2:00 PM CT" },
  { id: "E2-2", group: "E", md: 2, date: "Jun 20", home: "ECU", away: "CUW", status: "SCHED", venue: "KC",  kickoff: "5:00 PM CT" },
  { id: "E3-1", group: "E", md: 3, date: "Jun 25", home: "ECU", away: "GER", status: "SCHED", venue: "HOU", kickoff: "3:00 PM CT" },
  { id: "E3-2", group: "E", md: 3, date: "Jun 25", home: "CUW", away: "CIV", status: "SCHED", venue: "DAL", kickoff: "3:00 PM CT" },

  // ─────────── GROUP F ───────────
  { id: "F1-1", group: "F", md: 1, date: "Jun 14", home: "NED", away: "JPN", hs: 2, as: 1, status: "FT", venue: "MIA", kickoff: "6:00 PM ET" },
  { id: "F1-2", group: "F", md: 1, date: "Jun 14", home: "SWE", away: "TUN", hs: 1, as: 1, status: "FT", venue: "NYC", kickoff: "12:00 PM ET" },
  { id: "F2-1", group: "F", md: 2, date: "Jun 20", home: "NED", away: "SWE", status: "SCHED", venue: "NYC", kickoff: "12:00 PM ET" },
  { id: "F2-2", group: "F", md: 2, date: "Jun 20", home: "TUN", away: "JPN", status: "SCHED", venue: "ATL", kickoff: "8:00 PM ET" },
  { id: "F3-1", group: "F", md: 3, date: "Jun 25", home: "TUN", away: "NED", status: "SCHED", venue: "MIA", kickoff: "12:00 PM ET" },
  { id: "F3-2", group: "F", md: 3, date: "Jun 25", home: "JPN", away: "SWE", status: "SCHED", venue: "NYC", kickoff: "12:00 PM ET" },

  // ─────────── GROUP G ───────────
  { id: "G1-1", group: "G", md: 1, date: "Jun 15", home: "BEL", away: "EGY", hs: 2, as: 0, status: "FT", venue: "BOS", kickoff: "12:00 PM ET" },
  { id: "G1-2", group: "G", md: 1, date: "Jun 15", home: "IRN", away: "NZL", hs: 1, as: 2, status: "FT", venue: "SEA", kickoff: "3:00 PM PT" },
  { id: "G2-1", group: "G", md: 2, date: "Jun 21", home: "BEL", away: "IRN", status: "SCHED", venue: "BOS", kickoff: "3:00 PM ET" },
  { id: "G2-2", group: "G", md: 2, date: "Jun 21", home: "NZL", away: "EGY", status: "SCHED", venue: "SEA", kickoff: "12:00 PM PT" },
  { id: "G3-1", group: "G", md: 3, date: "Jun 26", home: "NZL", away: "BEL", status: "SCHED", venue: "BOS", kickoff: "12:00 PM ET" },
  { id: "G3-2", group: "G", md: 3, date: "Jun 26", home: "EGY", away: "IRN", status: "SCHED", venue: "SEA", kickoff: "12:00 PM PT" },

  // ─────────── GROUP H ───────────
  { id: "H1-1", group: "H", md: 1, date: "Jun 15", home: "ESP", away: "CPV", hs: 3, as: 1, status: "FT", venue: "SFO", kickoff: "12:00 PM PT" },
  { id: "H1-2", group: "H", md: 1, date: "Jun 15", home: "KSA", away: "URU", hs: 0, as: 2, status: "FT", venue: "HOU", kickoff: "3:00 PM CT" },
  { id: "H2-1", group: "H", md: 2, date: "Jun 21", home: "ESP", away: "KSA", status: "SCHED", venue: "MTY", kickoff: "3:00 PM CT" },
  { id: "H2-2", group: "H", md: 2, date: "Jun 21", home: "URU", away: "CPV", status: "SCHED", venue: "GDL", kickoff: "12:00 PM CT" },
  { id: "H3-1", group: "H", md: 3, date: "Jun 26", home: "URU", away: "ESP", status: "SCHED", venue: "AZT", kickoff: "5:00 PM CT" },
  { id: "H3-2", group: "H", md: 3, date: "Jun 26", home: "CPV", away: "KSA", status: "SCHED", venue: "MTY", kickoff: "5:00 PM CT" },

  // ─────────── GROUP I ───────────
  { id: "I1-1", group: "I", md: 1, date: "Jun 16", home: "FRA", away: "SEN", hs: 2, as: 0, status: "FT", venue: "BOS", kickoff: "12:00 PM ET" },
  { id: "I1-2", group: "I", md: 1, date: "Jun 16", home: "IRQ", away: "NOR", hs: 0, as: 3, status: "FT", venue: "NYC", kickoff: "3:00 PM ET" },
  { id: "I2-1", group: "I", md: 2, date: "Jun 22", home: "FRA", away: "IRQ", status: "SCHED", venue: "MIA", kickoff: "12:00 PM ET" },
  { id: "I2-2", group: "I", md: 2, date: "Jun 22", home: "NOR", away: "SEN", status: "SCHED", venue: "BOS", kickoff: "3:00 PM ET" },
  { id: "I3-1", group: "I", md: 3, date: "Jun 26", home: "NOR", away: "FRA", status: "SCHED", venue: "PHI", kickoff: "3:00 PM ET" },
  { id: "I3-2", group: "I", md: 3, date: "Jun 26", home: "SEN", away: "IRQ", status: "SCHED", venue: "MIA", kickoff: "3:00 PM ET" },

  // ─────────── GROUP J ───────────
  { id: "J1-1", group: "J", md: 1, date: "Jun 16", home: "ARG", away: "ALG", hs: 3, as: 1, status: "FT", venue: "DAL", kickoff: "8:00 PM CT" },
  { id: "J1-2", group: "J", md: 1, date: "Jun 16", home: "AUT", away: "JOR", hs: 2, as: 1, status: "FT", venue: "KC",  kickoff: "5:00 PM CT" },
  { id: "J2-1", group: "J", md: 2, date: "Jun 22", home: "ARG", away: "AUT", status: "SCHED", venue: "DAL", kickoff: "8:00 PM CT" },
  { id: "J2-2", group: "J", md: 2, date: "Jun 22", home: "JOR", away: "ALG", status: "SCHED", venue: "KC",  kickoff: "5:00 PM CT" },
  { id: "J3-1", group: "J", md: 3, date: "Jun 27", home: "JOR", away: "ARG", status: "SCHED", venue: "MIA", kickoff: "8:00 PM ET" },
  { id: "J3-2", group: "J", md: 3, date: "Jun 27", home: "ALG", away: "AUT", status: "SCHED", venue: "DAL", kickoff: "8:00 PM CT" },

  // ─────────── GROUP K ───────────
  { id: "K1-1", group: "K", md: 1, date: "Jun 17", home: "POR", away: "COD", hs: 2, as: 0, status: "FT", venue: "SFO", kickoff: "12:00 PM PT" },
  { id: "K1-2", group: "K", md: 1, date: "Jun 17", home: "UZB", away: "COL", hs: 1, as: 2, status: "FT", venue: "ATL", kickoff: "3:00 PM ET" },
  { id: "K2-1", group: "K", md: 2, date: "Jun 23", home: "POR", away: "UZB", status: "SCHED", venue: "ATL", kickoff: "3:00 PM ET" },
  { id: "K2-2", group: "K", md: 2, date: "Jun 23", home: "COL", away: "COD", status: "SCHED", venue: "SFO", kickoff: "12:00 PM PT" },
  { id: "K3-1", group: "K", md: 3, date: "Jun 27", home: "COL", away: "POR", status: "SCHED", venue: "SFO", kickoff: "12:00 PM PT" },
  { id: "K3-2", group: "K", md: 3, date: "Jun 27", home: "COD", away: "UZB", status: "SCHED", venue: "ATL", kickoff: "3:00 PM ET" },

  // ─────────── GROUP L ───────────
  { id: "L1-1", group: "L", md: 1, date: "Jun 17", home: "ENG", away: "CRO", hs: 2, as: 1, status: "FT", venue: "PHI", kickoff: "3:00 PM ET" },
  { id: "L1-2", group: "L", md: 1, date: "Jun 17", home: "GHA", away: "PAN", hs: 1, as: 1, status: "FT", venue: "HOU", kickoff: "2:00 PM CT" },
  { id: "L2-1", group: "L", md: 2, date: "Jun 23", home: "ENG", away: "GHA", status: "SCHED", venue: "PHI", kickoff: "3:00 PM ET" },
  { id: "L2-2", group: "L", md: 2, date: "Jun 23", home: "PAN", away: "CRO", status: "SCHED", venue: "HOU", kickoff: "5:00 PM CT" },
  { id: "L3-1", group: "L", md: 3, date: "Jun 27", home: "PAN", away: "ENG", status: "SCHED", venue: "ATL", kickoff: "12:00 PM ET" },
  { id: "L3-2", group: "L", md: 3, date: "Jun 27", home: "CRO", away: "GHA", status: "SCHED", venue: "MIA", kickoff: "12:00 PM ET" },
];

// Compute standings from completed matches.
export function computeStandings(group, matches) {
  const teams = group.teams;
  const rows = Object.fromEntries(teams.map(t => [t, {
    team: t, pld: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0
  }]));
  for (const m of matches) {
    if (m.group !== group.id) continue;
    if (m.status !== "FT") continue;
    const h = rows[m.home], a = rows[m.away];
    h.pld++; a.pld++;
    h.gf += m.hs; h.ga += m.as;
    a.gf += m.as; a.ga += m.hs;
    if (m.hs > m.as)        { h.w++; a.l++; h.pts += 3; }
    else if (m.hs < m.as)   { a.w++; h.l++; a.pts += 3; }
    else                    { h.d++; a.d++; h.pts++; a.pts++; }
  }
  Object.values(rows).forEach(r => r.gd = r.gf - r.ga);
  return Object.values(rows).sort((a,b) =>
    b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.team.localeCompare(b.team)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tactical formations: 11 {x,y} positions on a 100×100 pitch grid.
// x: 0 = left sideline, 100 = right sideline.
// y: 0 = team's own goal, 100 = opposing goal.
// ─────────────────────────────────────────────────────────────────────────────
export const FORMATIONS = {
  // Classic attacking shape: back four, three central mids, front three wide.
  "4-3-3": [
    { x: 50, y: 6  },                                       // GK
    { x: 82, y: 28 }, { x: 62, y: 30 }, { x: 38, y: 30 }, { x: 18, y: 28 }, // RB, RCB, LCB, LB
    { x: 70, y: 55 }, { x: 50, y: 52 }, { x: 30, y: 55 },   // RCM, CM, LCM
    { x: 80, y: 80 }, { x: 50, y: 85 }, { x: 20, y: 80 },   // RW, ST, LW
  ],

  // Double pivot with a #10 behind a lone striker — modern balanced shape.
  "4-2-3-1": [
    { x: 50, y: 6  },                                       // GK
    { x: 82, y: 28 }, { x: 62, y: 30 }, { x: 38, y: 30 }, { x: 18, y: 28 }, // back four
    { x: 62, y: 48 }, { x: 38, y: 48 },                     // double pivot
    { x: 78, y: 68 }, { x: 50, y: 65 }, { x: 22, y: 68 },   // RAM, CAM, LAM
    { x: 50, y: 86 },                                       // ST
  ],

  // Flat back four, flat midfield four, two strikers — traditional English shape.
  "4-4-2": [
    { x: 50, y: 6  },                                       // GK
    { x: 82, y: 28 }, { x: 62, y: 30 }, { x: 38, y: 30 }, { x: 18, y: 28 }, // back four
    { x: 82, y: 55 }, { x: 60, y: 56 }, { x: 40, y: 56 }, { x: 18, y: 55 }, // midfield four
    { x: 60, y: 84 }, { x: 40, y: 84 },                     // strike pair
  ],

  // Back three with attacking wing-backs and two strikers — wide overload.
  "3-5-2": [
    { x: 50, y: 6  },                                       // GK
    { x: 75, y: 28 }, { x: 50, y: 28 }, { x: 25, y: 28 },   // back three
    { x: 88, y: 55 }, { x: 65, y: 55 }, { x: 50, y: 50 }, { x: 35, y: 55 }, { x: 12, y: 55 }, // wing-backs + central trio
    { x: 60, y: 84 }, { x: 40, y: 84 },                     // strike pair
  ],

  // Defensive back five with compact midfield three — counter-attacking shape.
  "5-3-2": [
    { x: 50, y: 6  },                                       // GK
    { x: 88, y: 28 }, { x: 68, y: 30 }, { x: 50, y: 30 }, { x: 32, y: 30 }, { x: 12, y: 28 }, // back five
    { x: 68, y: 56 }, { x: 50, y: 56 }, { x: 32, y: 56 },   // midfield three
    { x: 60, y: 84 }, { x: 40, y: 84 },                     // strike pair
  ],

  // Christmas tree: narrow attacking trident behind a lone striker — central density.
  "4-3-2-1": [
    { x: 50, y: 6  },                                       // GK
    { x: 82, y: 28 }, { x: 62, y: 30 }, { x: 38, y: 30 }, { x: 18, y: 28 }, // back four
    { x: 70, y: 55 }, { x: 50, y: 52 }, { x: 30, y: 55 },   // midfield three
    { x: 62, y: 72 }, { x: 38, y: 72 },                     // two #10s
    { x: 50, y: 86 },                                       // ST
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Team lineups: 11 starters (GK → defence → midfield → attack), subs, coach.
// Names are plausible-by-nationality, not real squads.
// Starters are ordered consistently: GK, then back line right→left, then mids
// right→left, then attack right→left, matching the FORMATIONS coordinate order.
// ─────────────────────────────────────────────────────────────────────────────
export const LINEUPS = {
  // Brazil — Lusophone names, 4-2-3-1 with creative #10.
  BRA: {
    formation: "4-2-3-1",
    starters: [
      { n: 1,  name: "G. Alves" },
      { n: 2,  name: "D. Santos" },
      { n: 4,  name: "M. Ribeiro" },
      { n: 3,  name: "R. Vieira" },
      { n: 6,  name: "F. Costa" },
      { n: 5,  name: "B. Moreira" },
      { n: 8,  name: "T. Oliveira" },
      { n: 7,  name: "L. Souza" },
      { n: 10, name: "P. Cardoso" },
      { n: 11, name: "V. Martins" },
      { n: 9,  name: "C. Almeida" },
    ],
    subs: ["A. Cruz", "E. Barbosa", "J. Mendes", "N. Pereira", "R. Tavares", "S. Lima", "H. Nogueira"],
    coach: "Tito Bernardes",
  },

  // Haiti — Haitian-French names, 4-3-3.
  HAI: {
    formation: "4-3-3",
    starters: [
      { n: 22, name: "J. Pierre" },
      { n: 2,  name: "K. Joseph" },
      { n: 4,  name: "M. Saint-Juste" },
      { n: 5,  name: "F. Cadet" },
      { n: 3,  name: "W. Charles" },
      { n: 8,  name: "R. Dorsainvil" },
      { n: 6,  name: "S. Belfort" },
      { n: 10, name: "D. Augustin" },
      { n: 7,  name: "E. Delva" },
      { n: 9,  name: "L. Toussaint" },
      { n: 11, name: "N. Boucicaut" },
    ],
    subs: ["B. Lafleur", "Y. Désir", "G. Métellus", "T. Florvil", "O. Casimir", "A. Vincent"],
    coach: "Marc-André Étienne",
  },

  // USA — Anglo-American names, 4-3-3.
  USA: {
    formation: "4-3-3",
    starters: [
      { n: 1,  name: "M. Turner" },
      { n: 2,  name: "S. Dest" },
      { n: 5,  name: "C. Richards" },
      { n: 4,  name: "T. Ream" },
      { n: 3,  name: "A. Robinson" },
      { n: 6,  name: "J. McKenzie" },
      { n: 8,  name: "W. McKennie" },
      { n: 10, name: "C. Pulisic" },
      { n: 7,  name: "B. Aaronson" },
      { n: 9,  name: "J. Sargent" },
      { n: 11, name: "T. Weah" },
    ],
    subs: ["G. Reyna", "Y. Musah", "L. de la Torre", "P. Paredes", "R. Ferreira", "K. Scally", "E. Horvath"],
    coach: "Greg Hartmann",
  },

  // Australia — Anglo + immigrant-Australian names, 4-4-2.
  AUS: {
    formation: "4-4-2",
    starters: [
      { n: 1,  name: "M. Ryan" },
      { n: 2,  name: "M. Degenek" },
      { n: 4,  name: "H. Souttar" },
      { n: 5,  name: "K. Rowles" },
      { n: 3,  name: "A. Behich" },
      { n: 7,  name: "M. Leckie" },
      { n: 6,  name: "A. Mooy" },
      { n: 13, name: "J. Hrustic" },
      { n: 11, name: "A. Karacic" },
      { n: 9,  name: "J. Maclaren" },
      { n: 10, name: "M. Duke" },
    ],
    subs: ["R. Strain", "C. Goodwin", "K. Metcalfe", "C. Boyle", "B. Cummings", "J. Irvine"],
    coach: "Patrick Walsh",
  },

  // Mexico — Hispanic names, 4-3-3.
  MEX: {
    formation: "4-3-3",
    starters: [
      { n: 1,  name: "G. Ochoa" },
      { n: 2,  name: "J. Sánchez" },
      { n: 4,  name: "C. Montes" },
      { n: 3,  name: "H. Moreno" },
      { n: 23, name: "J. Gallardo" },
      { n: 8,  name: "L. Chávez" },
      { n: 6,  name: "E. Álvarez" },
      { n: 16, name: "H. Herrera" },
      { n: 22, name: "H. Lozano" },
      { n: 9,  name: "R. Jiménez" },
      { n: 11, name: "A. Vega" },
    ],
    subs: ["U. Antuna", "S. Córdova", "O. Pineda", "K. Álvarez", "R. Funes Mori", "D. Lainez", "A. Talavera"],
    coach: "Diego Aguirre",
  },

  // South Africa — Bantu + Afrikaans surnames, 4-2-3-1.
  ZAF: {
    formation: "4-2-3-1",
    starters: [
      { n: 1,  name: "R. Williams" },
      { n: 2,  name: "K. Mokoena" },
      { n: 4,  name: "S. Mbatha" },
      { n: 5,  name: "M. Hlatshwayo" },
      { n: 3,  name: "T. Modiba" },
      { n: 6,  name: "T. Mokoena" },
      { n: 8,  name: "B. Mvala" },
      { n: 7,  name: "P. Shalulile" },
      { n: 10, name: "T. Zwane" },
      { n: 11, name: "L. Mothiba" },
      { n: 9,  name: "S. Saleng" },
    ],
    subs: ["M. Foster", "I. Sithole", "N. Dlamini", "Z. Mahlangu", "B. Bartman", "K. Du Preez"],
    coach: "Pieter van Zyl",
  },

  // Canada — Anglo-Canadian + French-Canadian mix, 4-3-3.
  CAN: {
    formation: "4-3-3",
    starters: [
      { n: 1,  name: "M. Borjan" },
      { n: 2,  name: "A. Johnston" },
      { n: 4,  name: "K. Miller" },
      { n: 5,  name: "S. Vitória" },
      { n: 3,  name: "S. Adekugbe" },
      { n: 8,  name: "L. Piette" },
      { n: 6,  name: "S. Eustáquio" },
      { n: 13, name: "A. Hutchinson" },
      { n: 11, name: "T. Buchanan" },
      { n: 9,  name: "C. Larin" },
      { n: 14, name: "J. David" },
    ],
    subs: ["A. Davies", "L. Cavallini", "I. Laryea", "J. Hoilett", "M. Kaye", "D. Wotherspoon", "T. Crépeau"],
    coach: "Owen MacAllister",
  },

  // Bosnia & Herzegovina — Slavic + South Slavic names, 4-4-2.
  BIH: {
    formation: "4-4-2",
    starters: [
      { n: 1,  name: "I. Šehić" },
      { n: 2,  name: "S. Kvržić" },
      { n: 4,  name: "T. Šunjić" },
      { n: 5,  name: "S. Hadžikadunić" },
      { n: 3,  name: "E. Kolašinac" },
      { n: 7,  name: "E. Višća" },
      { n: 6,  name: "M. Pjanić" },
      { n: 8,  name: "R. Krunić" },
      { n: 11, name: "E. Hodžić" },
      { n: 9,  name: "E. Džeko" },
      { n: 10, name: "H. Demirović" },
    ],
    subs: ["A. Prevljak", "M. Gojak", "B. Saračević", "D. Bičakčić", "N. Memić", "A. Tahirović"],
    coach: "Mirsad Kovačević",
  },

  // Morocco — Arabic-Berber-French mix, 4-3-3.
  MAR: {
    formation: "4-3-3",
    starters: [
      { n: 1,  name: "Y. Bounou" },
      { n: 2,  name: "A. Hakimi" },
      { n: 5,  name: "N. Aguerd" },
      { n: 4,  name: "R. Saïss" },
      { n: 3,  name: "N. Mazraoui" },
      { n: 8,  name: "A. Ounahi" },
      { n: 6,  name: "S. Amrabat" },
      { n: 7,  name: "H. Ziyech" },
      { n: 10, name: "S. Boufal" },
      { n: 9,  name: "Y. En-Nesyri" },
      { n: 11, name: "S. Mmaee" },
    ],
    subs: ["A. Sabiri", "B. Dari", "Z. Aboukhlal", "I. Chair", "M. Cheddira", "Y. Belammari"],
    coach: "Karim Bensaïd",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Per-match details: stats, timeline events, attendance.
// Stats arrays are [home, away]. Timeline player names match LINEUPS starters
// for teams that have a lineup defined; otherwise plausible names are used.
// ─────────────────────────────────────────────────────────────────────────────
export const MATCH_DETAILS = {
  // C2-1: BRA 2-0 HAI, LIVE 67' — first half over, second half in progress.
  "C2-1": {
    stats: {
      "Possession": [63, 37],
      "Shots":      [13, 4],
      "On target":  [6, 1],
      "Corners":    [7, 1],
      "Fouls":      [8, 12],
      "Pass acc%":  [89, 76],
    },
    timeline: [
      { type: "goal",   min: "14'", team: "BRA", player: "L. Souza",    assist: "P. Cardoso", score: "1-0" },
      { type: "yellow", min: "31'", team: "HAI", player: "S. Belfort" },
      { type: "half",   min: "45'" },
      { type: "yellow", min: "52'", team: "BRA", player: "F. Costa" },
      { type: "sub",    min: "58'", team: "HAI", playerOff: "D. Augustin", playerOn: "B. Lafleur" },
      { type: "goal",   min: "63'", team: "BRA", player: "M. Ribeiro", assist: "V. Martins", score: "2-0" },
    ],
    fans: 11200,
  },

  // D2-1: USA 1-0 AUS, LIVE 23' — first half only, single goal so far.
  "D2-1": {
    stats: {
      "Possession": [58, 42],
      "Shots":      [5, 2],
      "On target":  [2, 0],
      "Corners":    [2, 1],
      "Fouls":      [3, 5],
      "Pass acc%":  [86, 79],
    },
    timeline: [
      { type: "yellow", min: "8'",  team: "AUS", player: "M. Degenek" },
      { type: "goal",   min: "18'", team: "USA", player: "C. Pulisic", assist: "T. Weah", score: "1-0" },
    ],
    fans: 13500,
  },

  // A2-1: MEX 3-2 KOR, FT. KOR has no full lineup so opponent scorers use
  // plausible Korean names inline.
  "A2-1": {
    stats: {
      "Possession": [54, 46],
      "Shots":      [15, 11],
      "On target":  [7, 5],
      "Corners":    [6, 4],
      "Fouls":      [11, 14],
      "Pass acc%":  [85, 82],
    },
    timeline: [
      { type: "goal",   min: "12'", team: "MEX", player: "R. Jiménez", assist: "H. Lozano", score: "1-0" },
      { type: "goal",   min: "29'", team: "KOR", player: "H. Son",                          score: "1-1" },
      { type: "yellow", min: "38'", team: "MEX", player: "E. Álvarez" },
      { type: "half",   min: "45'" },
      { type: "goal",   min: "54'", team: "MEX", player: "A. Vega",    assist: "L. Chávez", score: "2-1" },
      { type: "goal",   min: "67'", team: "KOR", player: "G. Hwang",                        score: "2-2" },
      { type: "sub",    min: "74'", team: "MEX", playerOff: "H. Herrera", playerOn: "U. Antuna" },
      { type: "goal",   min: "82'", team: "MEX", player: "H. Lozano",  assist: "A. Vega",   score: "3-2" },
      { type: "yellow", min: "88'", team: "KOR", player: "M. Kim" },
      { type: "full",   min: "90'" },
    ],
    fans: 9800,
  },

  // A1-1: MEX 2-1 ZAF, FT.
  "A1-1": {
    stats: {
      "Possession": [57, 43],
      "Shots":      [14, 8],
      "On target":  [6, 3],
      "Corners":    [5, 2],
      "Fouls":      [10, 12],
      "Pass acc%":  [87, 80],
    },
    timeline: [
      { type: "goal",   min: "21'", team: "MEX", player: "H. Lozano",  assist: "R. Jiménez", score: "1-0" },
      { type: "yellow", min: "34'", team: "ZAF", player: "T. Modiba" },
      { type: "half",   min: "45'" },
      { type: "goal",   min: "58'", team: "ZAF", player: "P. Shalulile", assist: "T. Zwane", score: "1-1" },
      { type: "sub",    min: "70'", team: "MEX", playerOff: "A. Vega",  playerOn: "S. Córdova" },
      { type: "goal",   min: "79'", team: "MEX", player: "R. Jiménez", assist: "L. Chávez",  score: "2-1" },
      { type: "yellow", min: "86'", team: "ZAF", player: "B. Mvala" },
      { type: "full",   min: "90'" },
    ],
    fans: 8400,
  },

  // B1-1: CAN 1-0 BIH, FT.
  "B1-1": {
    stats: {
      "Possession": [49, 51],
      "Shots":      [10, 9],
      "On target":  [4, 3],
      "Corners":    [3, 4],
      "Fouls":      [13, 11],
      "Pass acc%":  [83, 84],
    },
    timeline: [
      { type: "yellow", min: "19'", team: "BIH", player: "M. Pjanić" },
      { type: "goal",   min: "37'", team: "CAN", player: "J. David",   assist: "T. Buchanan", score: "1-0" },
      { type: "half",   min: "45'" },
      { type: "yellow", min: "61'", team: "CAN", player: "S. Eustáquio" },
      { type: "sub",    min: "72'", team: "BIH", playerOff: "H. Demirović", playerOn: "A. Prevljak" },
      { type: "sub",    min: "80'", team: "CAN", playerOff: "C. Larin", playerOn: "L. Cavallini" },
      { type: "full",   min: "90'" },
    ],
    fans: 7200,
  },
};
