// Internal v2 shapes consumed by components. See docs/plan/02-data-contracts.md.
// JSDoc only — no runtime cost.

/**
 * @typedef {Object} Team
 * @property {number} id
 * @property {string} short              3-letter abbreviation, uppercase
 * @property {string} name
 * @property {string} code               ISO-2 lowercase for flagcdn (e.g. "br", "gb-sct")
 * @property {string|null} confederation
 */

/**
 * @typedef {Object} Group
 * @property {string} id                 "A".."L"
 * @property {string[]} teams            team short codes
 * @property {string|null} host
 */

/**
 * @typedef {Object} Venue
 * @property {number} id
 * @property {string} short
 * @property {string} name
 * @property {string|null} city
 * @property {string|null} country
 * @property {number|null} capacity
 */

/** @typedef {"SCHED"|"LIVE"|"HT"|"FT"|"PP"|"CXL"} MatchStatus */
/** @typedef {"group"|"r32"|"r16"|"qf"|"sf"|"final"|"third_place"} Stage */

/**
 * @typedef {Object} Match
 * @property {string} id
 * @property {number} season
 * @property {Stage} stage
 * @property {string} stage_label
 * @property {string|null} group
 * @property {1|2|3|null} md
 * @property {string} home                team short
 * @property {string} away                team short
 * @property {number} homeId
 * @property {number} awayId
 * @property {number|null} hs
 * @property {number|null} as
 * @property {{hs:number, as:number}|null} pens
 * @property {MatchStatus} status
 * @property {string|null} minute
 * @property {string} kickoff_iso
 * @property {number|null} venueId
 * @property {string|null} venueShort
 * @property {string|null} home_formation
 * @property {string|null} away_formation
 * @property {string|null} referee
 * @property {number|null} attendance
 */

/**
 * @typedef {Object} Standing
 * @property {string} team
 * @property {number} pld
 * @property {number} w
 * @property {number} d
 * @property {number} l
 * @property {number} gf
 * @property {number} ga
 * @property {number} gd
 * @property {number} pts
 * @property {number} pos
 */

/**
 * @typedef {Object} PlayerRef
 * @property {number} id
 * @property {string} name
 * @property {string|null} short_name
 * @property {"GK"|"DF"|"MF"|"FW"|null} position
 * @property {number|null} n
 */

/**
 * @typedef {Object} Lineup
 * @property {string} team
 * @property {string|null} formation
 * @property {PlayerRef[]} starters
 * @property {PlayerRef[]} subs
 * @property {string|null} coach
 */

/**
 * @typedef {Object} MatchEvent
 * @property {string} type
 * @property {string} min
 * @property {string|null} team
 * @property {string=} player
 * @property {string=} playerOff
 * @property {string=} playerOn
 * @property {string=} assist
 * @property {string=} score
 */

/**
 * @typedef {Object} MatchStats
 * @property {string[]} labels
 * @property {Record<string, [number, number]>} values
 * @property {[number, number]|null} xG
 */

/**
 * @typedef {Object} MatchDetails
 * @property {string} matchId
 * @property {{home: Lineup|null, away: Lineup|null}} lineups
 * @property {MatchEvent[]} events
 * @property {MatchStats|null} stats
 * @property {number|null} attendance
 * @property {{lineups?: boolean, events?: boolean, stats?: boolean}=} tier_required
 */

export {}
