(function() {
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

const NOW = "Fri, Jun 19 · 4:31 PM ET";

// ISO country codes for flagcdn (https://flagcdn.com/w80/<code>.png)
const TEAMS = {
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
const GROUPS = [
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
const VENUES = {
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

const MATCHES = [
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
function computeStandings(group, matches) {
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

window.WC = { NOW, TEAMS, GROUPS, VENUES, MATCHES, computeStandings };
})();
