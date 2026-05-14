// Pure mapper: FIFAMatch (upstream) → Match (internal v2).
// Mirrors docs/plan/02-data-contracts.md §§ 3.3, 4, 7, 8.

import type { FIFAMatch } from '../upstream/types.js'
import type { Match, MatchStatus, Season, Stage } from '../internal/types.js'
import { logger } from '../util/logging.js'
import { mapStadium } from './stadium.js'
import { mapTeam } from './team.js'

// Mappers are otherwise pure; the only side effect is a structured warn
// log for upstream values we don't recognise.
function warn(event: string, fields: Record<string, unknown>): void {
  logger.warn(event, fields)
}

function mapStatus(upstream: string): MatchStatus {
  switch (upstream) {
    case 'scheduled':
      return 'SCHED'
    case 'in_progress':
      return 'LIVE'
    case 'half_time':
      return 'HT'
    case 'completed':
      return 'FT'
    case 'postponed':
      return 'PP'
    case 'cancelled':
      return 'CXL'
    default:
      warn('mapMatch.unknown_status', { upstream })
      return 'SCHED'
  }
}

function mapStage(stageName: string): Stage {
  switch (stageName) {
    case 'Group Stage':
    case 'group_stage':
    case 'group':
      return 'group'
    case 'Round of 32':
    case 'round_of_32':
      return 'r32'
    case 'Round of 16':
    case 'round_of_16':
      return 'r16'
    case 'Quarterfinal':
    case 'Quarter-final':
    case 'Quarter-finals':
    case 'quarter_finals':
      return 'qf'
    case 'Semifinal':
    case 'Semi-final':
    case 'Semi-finals':
    case 'semi_finals':
      return 'sf'
    case 'Final':
    case 'final':
      return 'final'
    case 'Third Place':
    case 'Third-Place Play-Off':
    case 'Match for 3rd place':
    case 'third_place_playoff':
      return 'third_place'
    default:
      warn('mapMatch.unknown_stage', { stageName })
      return 'group'
  }
}

function stageLabel(stage: Stage, groupLetter: string | null, md: number | null): string {
  if (stage === 'group') {
    if (groupLetter && md != null) return `Group ${groupLetter} · MD ${md}`
    if (groupLetter) return `Group ${groupLetter}`
    return 'Group Stage'
  }
  switch (stage) {
    case 'r32':
      return 'Round of 32'
    case 'r16':
      return 'Round of 16'
    case 'qf':
      return 'Quarterfinal'
    case 'sf':
      return 'Semifinal'
    case 'final':
      return 'Final'
    case 'third_place':
      return 'Third-Place Play-Off'
    default:
      return ''
  }
}

function groupLetterFromName(groupName: string | null | undefined): string | null {
  if (!groupName) return null
  // "Group A" → "A"
  const parts = groupName.trim().split(/\s+/)
  const last = parts[parts.length - 1] ?? ''
  return last.length > 0 ? last.toUpperCase() : null
}

/**
 * Derive matchday (1, 2, 3) for a group-stage match.
 *
 * The captured FIFA fixtures expose `match_number` as a per-group
 * matchday (1, 2, 3) on group-stage matches, not a tournament-wide
 * counter. If a future upstream changes this and emits a tournament-
 * wide counter > 3, fall back to ceil(match_number / matchesPerMd)
 * with matchesPerMd inferred from team count:
 *   - 48 teams (2026) → 12 groups × 2 fixtures = 24 matches per MD
 *   - 32 teams (2018/2022) → 8 groups × 2 fixtures = 16 matches per MD
 */
function deriveMd(
  matchNumber: number | null,
  season: number,
): 1 | 2 | 3 | null {
  if (matchNumber == null) return null
  if (matchNumber >= 1 && matchNumber <= 3) return matchNumber as 1 | 2 | 3
  // Defensive fallback for tournament-wide counters
  const matchesPerMd = season >= 2026 ? 24 : 16
  const md = Math.ceil(matchNumber / matchesPerMd)
  if (md >= 1 && md <= 3) return md as 1 | 2 | 3
  return null
}

interface ScoreResult {
  hs: number | null
  as: number | null
  pens: { hs: number; as: number } | null
}

function deriveScores(m: FIFAMatch, status: MatchStatus): ScoreResult {
  if (status === 'SCHED' || status === 'PP' || status === 'CXL') {
    return { hs: null, as: null, pens: null }
  }
  // `home_score`/`away_score` is the **running total** in the captured
  // fixtures (regulation + ET when ET is played). Penalties are NOT
  // included in `home_score`; they live in `home_score_penalties`.
  //
  // Precedence:
  //   FT with pens → hs/as = home_score/away_score (regulation+ET);
  //                  pens = { hs: home_score_penalties, as: ... }.
  //   FT (regulation or ET) → hs/as = home_score/away_score.
  //   LIVE/HT → hs/as = home_score/away_score (current tally).
  if (status === 'FT') {
    if (
      m.home_score_penalties != null &&
      m.away_score_penalties != null
    ) {
      return {
        hs: m.home_score,
        as: m.away_score,
        pens: { hs: m.home_score_penalties, as: m.away_score_penalties },
      }
    }
    return { hs: m.home_score, as: m.away_score, pens: null }
  }
  // LIVE / HT — running tally
  return { hs: m.home_score, as: m.away_score, pens: null }
}

/**
 * Pure mapper: upstream FIFAMatch → internal Match.
 * No I/O. Logs `console.warn` only for unknown status/stage strings.
 */
export function mapMatch(m: FIFAMatch): Match {
  const status = mapStatus(m.status)
  const stage = mapStage(m.stage.name)
  const groupLetter = groupLetterFromName(m.group?.name)
  const season = m.season.year as Season
  const md = stage === 'group' ? deriveMd(m.match_number, season) : null
  const home = mapTeam(m.home_team).short
  const away = mapTeam(m.away_team).short
  const venue = m.stadium ? mapStadium(m.stadium) : null
  const scores = deriveScores(m, status)

  return {
    id: String(m.id),
    season,
    stage,
    stage_label: stageLabel(stage, groupLetter, md),
    group: stage === 'group' ? groupLetter : null,
    md,
    home,
    away,
    homeId: m.home_team.id,
    awayId: m.away_team.id,
    hs: scores.hs,
    as: scores.as,
    pens: scores.pens,
    status,
    minute: null,
    kickoff_iso: m.datetime,
    venueId: venue?.id ?? null,
    venueShort: venue?.short ?? null,
    home_formation: m.home_formation,
    away_formation: m.away_formation,
    referee: m.referee ?? null,
    attendance: m.attendance ?? null,
  }
}
