// Mirror of the fields the FIFA World Cup endpoints return.
// Captured fixtures in test/fixtures/upstream/ are the source of truth.
// Field names match the upstream OpenAPI exactly; do not rename them.

export interface FIFAPagination {
  next_cursor: number | null
  per_page: number
}

export interface FIFASeasonRef {
  id: number
  year: number
}

export interface FIFATeam {
  id: number
  name: string
  abbreviation: string | null
  country_code: string | null
  confederation: string | null
}

export interface FIFAStadium {
  id: number
  name: string
  city: string | null
  country: string | null
  capacity: number | null
  latitude: number | null
  longitude: number | null
}

export interface FIFAGroupRef {
  id: number
  name: string
}

export interface FIFAStageRef {
  id: number
  name: string
  order: number | null
}

export interface FIFAStanding {
  season: FIFASeasonRef
  team: FIFATeam
  group: FIFAGroupRef
  position: number
  played: number
  won: number
  drawn: number
  lost: number
  goals_for: number
  goals_against: number
  goal_difference: number
  points: number
}

export interface FIFAScore {
  home: number | null
  away: number | null
}

export interface FIFAMatch {
  id: number
  match_number: number | null
  datetime: string                       // ISO-8601 UTC
  status: string                         // "scheduled" | "in_progress" | "completed" | ...
  season: FIFASeasonRef
  stage: FIFAStageRef
  group: FIFAGroupRef | null
  stadium: FIFAStadium | null
  home_team: FIFATeam
  away_team: FIFATeam
  home_score: number | null
  away_score: number | null
  home_score_half_time: number | null
  away_score_half_time: number | null
  home_score_extra_time: number | null
  away_score_extra_time: number | null
  home_score_penalties: number | null
  away_score_penalties: number | null
  home_formation: string | null
  away_formation: string | null
  referee: string | null
  home_manager: string | null
  away_manager: string | null
  attendance: number | null
}

export interface FIFAPlayer {
  id: number
  name: string
  short_name: string | null
  position: string | null                // "G" | "D" | "M" | "F"
  date_of_birth: string | null
  country_code: string | null
  country_name: string | null
  height_cm: number | null
  jersey_number: string | number | null
}

export interface FIFAMatchLineupRow {
  match_id: number
  team_id: number
  player: FIFAPlayer
  is_starter: boolean
  is_substitute: boolean
  shirt_number: number | null
  position: string | null
  formation: string | null
}

export interface FIFAMatchEvent {
  id: number
  match_id: number
  incident_type: string
  incident_class: string | null
  time_minute: number | null
  added_time: number | null
  period: string | null
  is_home: boolean
  player: FIFAPlayer | null
  assist_player: FIFAPlayer | null
  related_player: FIFAPlayer | null
  home_score: number | null
  away_score: number | null
}

export interface FIFATeamMatchStats {
  match_id: number
  team_id: number
  is_home: boolean
  possession_pct: number | null
  expected_goals: number | null
  big_chances: number | null
  big_chances_missed: number | null
  shots_total: number | null
  shots_on_target: number | null
  shots_off_target: number | null
  shots_blocked: number | null
  shots_inside_box: number | null
  shots_outside_box: number | null
  hit_woodwork: number | null
  corners: number | null
  offsides: number | null
  fouls: number | null
  yellow_cards: number | null
  red_cards: number | null
  passes_total: number | null
  passes_accurate: number | null
  passes_final_third: number | null
  long_balls_total: number | null
  long_balls_accurate: number | null
  crosses_total: number | null
  crosses_accurate: number | null
  duels_won: number | null
  tackles: number | null
  interceptions: number | null
  clearances: number | null
  blocks: number | null
  saves: number | null
}

export interface FIFAPlayerMatchStats {
  match_id: number
  player_id: number
  team_id: number
  is_home: boolean
  rating: number | null
  minutes_played: number | null
  expected_goals: number | null
  expected_assists: number | null
  goals: number | null
  assists: number | null
  shots_on_target: number | null
  passes_total: number | null
  passes_accurate: number | null
  key_passes: number | null
}

export interface FIFAMatchShot {
  id: number
  match_id: number
  player_id: number
  team_id: number
  is_home: boolean
  shot_type: string | null
  situation: string | null
  body_part: string | null
  goal_type: string | null
  xg: number | null
  xgot: number | null
  player_x: number | null
  player_y: number | null
  goal_mouth_x: number | null
  goal_mouth_y: number | null
  block_x: number | null
  block_y: number | null
  time_minute: number | null
  added_time: number | null
  time_seconds: number | null
}

export interface FIFAMatchBestPlayer {
  match_id: number
  player_id: number
  team_id: number
  is_home: boolean
  side_rank: number
  is_man_of_match: boolean
  rating: number | null
  reason: string | null
}

export interface FIFAMatchAvgPosition {
  match_id: number
  player_id: number
  team_id: number
  is_home: boolean
  avg_x: number | null
  avg_y: number | null
}

export interface FIFAMatchMomentumPoint {
  match_id: number
  minute: number
  value: number
}

export interface FIFARoster {
  season: FIFASeasonRef
  team_id: number
  player: FIFAPlayer
  position: string | null
  appearances: number | null
  starts: number | null
  minutes_played: number | null
  goals: number | null
  assists: number | null
  yellow_cards: number | null
  red_cards: number | null
  avg_rating: number | null
}

export interface FIFAList<T> {
  data: T[]
  meta?: FIFAPagination
}
