// Internal v2 shapes — the contract every handler returns and every
// frontend component consumes. Mappers are the only place upstream
// field names appear; consumers (handlers, frontend) see only these.
//
// Mirrors docs/plan/02-data-contracts.md § 2.

export type Season = 2018 | 2022 | 2026

export type Stage =
  | 'group'
  | 'r32'
  | 'r16'
  | 'qf'
  | 'sf'
  | 'final'
  | 'third_place'

export type MatchStatus = 'SCHED' | 'LIVE' | 'HT' | 'FT' | 'PP' | 'CXL'

export interface Team {
  id: number                       // upstream stable id
  short: string                    // 3-letter abbreviation, uppercase
  name: string
  code: string                     // ISO-2 lowercase for flagcdn (e.g. "br", "gb-sct")
  confederation: string | null
}

export interface Group {
  id: string                       // "A".."L"
  teams: string[]                  // team short codes
  host: string | null              // co-host country name, only for the host group(s)
}

export interface Venue {
  id: number
  short: string                    // synthesized 3-letter abbreviation
  name: string
  city: string | null
  country: string | null
  capacity: number | null
}

export interface PlayerRef {
  id: number
  name: string                     // display name
  short_name: string | null
  position: 'GK' | 'DF' | 'MF' | 'FW' | null
  n: number | null                 // jersey number
}

export interface PenaltyScore { hs: number; as: number }

export interface Match {
  id: string                       // stringified upstream id
  season: Season
  stage: Stage
  stage_label: string              // "Group A · MD 1" | "Round of 16" | "Final"
  group: string | null             // "A".."L" if stage === 'group'
  md: 1 | 2 | 3 | null             // only set for group stage
  home: string                     // team short
  away: string                     // team short
  homeId: number
  awayId: number
  hs: number | null
  as: number | null
  pens: PenaltyScore | null
  status: MatchStatus
  minute: string | null
  kickoff_iso: string              // ISO-8601 UTC
  venueId: number | null
  venueShort: string | null
  home_formation: string | null
  away_formation: string | null
  referee: string | null
  attendance: number | null
}

export interface Standing {
  team: string                     // team short
  teamId: number
  pld: number
  w: number
  d: number
  l: number
  gf: number
  ga: number
  gd: number
  pts: number
  pos: number
}

export interface Lineup {
  team: string                     // team short
  formation: string | null
  starters: PlayerRef[]            // length 11 when full
  subs: PlayerRef[]
  coach: string | null
}

export type EventType =
  | 'goal' | 'own_goal' | 'penalty_goal' | 'penalty_missed'
  | 'yellow' | 'red' | 'second_yellow'
  | 'sub'
  | 'half' | 'full' | 'et_start' | 'et_half' | 'et_full'
  | 'pen_start' | 'shootout_kick'
  | 'var'

export interface MatchEvent {
  type: EventType
  min: string                      // "14'" or "45' +2" or "90'"
  team: string | null              // team short, null for period markers
  player?: string
  playerOff?: string
  playerOn?: string
  assist?: string
  score?: string                   // e.g. "1-0"
}

export interface MatchStats {
  labels: string[]                            // canonical label order
  values: Record<string, [number, number]>    // label -> [home, away]
  xG: [number, number] | null
}

export interface MatchDetails {
  matchId: string
  lineups: { home: Lineup | null; away: Lineup | null }
  events: MatchEvent[]
  stats: MatchStats | null
  attendance: number | null
  tier_required?: { lineups?: boolean; events?: boolean; stats?: boolean }
}

export interface TierFlag { tier_required?: boolean }

export interface ApiList<T> extends TierFlag {
  data: T[]
}

export interface ApiSingle<T> extends TierFlag {
  data: T | null
}
