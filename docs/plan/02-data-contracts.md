# 02 — Data Contracts

> Status: draft v2. Owner: backend mappers + frontend selectors. Audience: the engineer writing `functions/src/mappers/*.ts` and the engineer touching `src/api/types.js` selectors. After reading this doc you should be able to implement every mapper and every Firestore document shape without re-opening the upstream OpenAPI spec.
>
> Related docs:
> - `01-architecture.md` — Firestore cache key shape (`season + resource + filters`) and refresh cadences.
> - `03-backend-functions.md` — Cloud Functions handlers consume the mappers spec'd here.
> - `04-frontend-swap.md` — Client must update component prop expectations to v2 fields (notably: `date` is dropped, `kickoff` becomes derived, score precedence changes).

---

## 1. Overview and principles

### 1.1 The contract

**The internal shape is the contract.** Components in `src/components/*` and pages in `src/pages/*` consume *only* internal-shape objects (`Match`, `Team`, `Group`, `Standing`, `Lineup`, `MatchEvent`, `MatchStats`). They never see upstream `FIFAMatch`, `FIFATeam`, etc. Upstream field names appear in exactly two places:

1. **Mapper modules** (`functions/src/mappers/*.ts`) — pure functions that take upstream JSON and return internal-shape objects.
2. **Fixture files** (`functions/test/fixtures/upstream/*.json`) — captured upstream responses used by mapper tests.

Anywhere else, treat upstream names as smell. If a component touches `country_code` or `home_team_source`, that is a bug.

### 1.2 Why mappers and not "just use upstream"

- Upstream renames a field → one file changes (the mapper) instead of every component.
- Upstream is paid per tier; the free tier exposes only teams + stadiums. Mappers let us hand-roll missing fields (e.g., synthesised venue short codes) without leaking that detail into the UI.
- Internal shapes are deliberately small. A `Match` has 12 fields; `FIFAMatch` has 30+. Components benefit from the narrower surface.

### 1.3 Where shapes are defined

| Location | Purpose | Language |
|---|---|---|
| `functions/src/mappers/types.ts` | Authoritative internal types and upstream interface types. | TypeScript |
| `functions/src/mappers/*.ts` | One module per resource (`team.ts`, `match.ts`, `lineup.ts`, `event.ts`, `team-stats.ts`, `stadium.ts`, `standing.ts`). | TypeScript |
| `src/api/types.js` | JSDoc typedef mirror of the internal types, for IDE help and runtime guards. No upstream types here. | JavaScript (JSDoc) |
| `functions/test/fixtures/upstream/*.json` | One captured response per endpoint. | JSON |
| `functions/test/mappers/*.test.ts` | One test file per mapper module; fixture-in → expected-out. | TypeScript |

### 1.4 The `_source` envelope

Every internal record written to Firestore carries a non-snake-cased `_source` envelope so we can debug staleness and rate-limit failures without polluting the API surface that the client receives.

```ts
type SourceEnvelope = {
  fetched_at: string;       // ISO 8601 UTC, server clock at write time
  etag: string | null;      // upstream ETag if provided, else null
  tier_required: 'free' | 'all_star' | 'goat';
  schema: 'v2';             // bumped when the internal shape changes
};
```

The envelope lives **inside Firestore documents** under the field `_source`. It is **stripped** by the Functions HTTP layer before responding to the client — the JSON shape the React app sees never contains `_source`. Stripping happens once, at the gateway. Mappers are not aware of `_source`.

### 1.5 IDs are stable across upstream changes

- `Team.id` = upstream `FIFATeam.id` (integer).
- `Match.id` = upstream `FIFAMatch.id` rendered as a string ("stringly typed" — preserves the existing `id: 'C2-1'` shape on the wire and in React keys, even though the value is now numeric).
- `Venue.id` = upstream `FIFAStadium.id`.
- `Group.id` = group letter `'A' | 'B' | ... | 'L'`, derived from upstream `FIFAGroup.name`.

If upstream renumbers, IDs change. We accept this — fixtures are pinned to a captured snapshot and we re-capture on upstream version bumps.

### 1.6 Naming style

- **Internal**: short, camelCase or single-word, optimised for reading in JSX (`home`, `away`, `hs`, `as`, `md`, `venue`).
- **Upstream**: snake_case, kept verbatim in mapper code so a reader can grep against the OpenAPI spec.

The mapper is the only line where the two meet.

---

## 2. Internal shape v2

All types are listed both as JSDoc typedefs (the format `src/api/types.js` will use) and TypeScript interfaces (the format `functions/src/mappers/types.ts` will use). The two must remain in lock-step; CI checks that field counts match.

### 2.1 `Team`

```ts
interface Team {
  id: number;            // upstream FIFATeam.id
  short: string;         // 3-letter UPPER abbreviation. Stable.  e.g., "BRA"
  name: string;          // display name. e.g., "Brazil"
  code: string;          // ISO-2 LOWER for flagcdn (https://flagcdn.com/w40/{code}.png). e.g., "br"
  confederation: string; // "CONMEBOL" | "UEFA" | "CONCACAF" | "AFC" | "CAF" | "OFC" | ""
}
```

JSDoc mirror:

```js
/**
 * @typedef {Object} Team
 * @property {number} id
 * @property {string} short      3-letter UPPER abbreviation
 * @property {string} name       display name
 * @property {string} code       ISO-2 lowercase, for flagcdn
 * @property {string} confederation
 */
```

**Compat note.** Today's `TEAMS = { BRA: { name, code, short } }` map becomes `TEAMS = { BRA: { id, name, code, short, confederation } }`. Keying remains by `short` so existing component lookups (`TEAMS[match.home]`) still work. The `id` field is additive; the existing UI ignores it.

### 2.2 `Group`

```ts
interface Group {
  id: 'A'|'B'|'C'|'D'|'E'|'F'|'G'|'H'|'I'|'J'|'K'|'L';
  host: string | null;   // display name of the host nation present in this group, or null
  teams: string[];       // ordered list of Team.short within the group
}
```

We keep `teams: string[]` (not `Team[]`) so the `GROUPS` constant stays cheap to serialise and so the group document doesn't duplicate team data. Components join via the `TEAMS` keyed map.

**Host derivation rule** (this is the only piece of business logic in the group mapper):

| Season | Host nations | Groups that contain a host | `host` value |
|---|---|---|---|
| 2018 | RUS | A | A → "Russia"; B–H → null |
| 2022 | QAT | A | A → "Qatar"; B–H → null |
| 2026 | MEX, CAN, USA | A (MEX), B (CAN), D (USA) per FIFA draw | A → "Mexico", B → "Canada", D → "United States"; others → null |

The host map is a static table in `functions/src/mappers/hosts.ts`, keyed by `season`. If the draw produces a different group assignment than the table assumes, fall back to "scan the group's teams; if any team's `short` is in the season's host set, that team's `name` becomes `host`; else null". The mapper logs a warning when the static and derived values disagree.

### 2.3 `Venue`

```ts
interface Venue {
  id: number;            // upstream FIFAStadium.id
  short: string;         // 3-letter UPPER, synthesised. e.g., "AZT", "MIA"
  name: string;          // display name. e.g., "Estadio Azteca"
  city: string;          // e.g., "Mexico City"
  country: string;       // ISO-2 UPPER or display name (whichever upstream provides)
  capacity: number | null;
}
```

**Compat note.** Today's `VENUES = { AZT: 'Mexico City Stadium' }` becomes `VENUES = { AZT: { id, short, name, city, country, capacity } }`. The string-only entries the UI uses today are derived: `VENUES[code].name`. There is a selector `venueDisplay(short)` that returns the string for code paths that still want the old shape.

**Short-code synthesis** — see §5.

### 2.4 `Match`

```ts
interface Match {
  id: string;             // upstream FIFAMatch.id coerced to string
  season: 2018 | 2022 | 2026;
  stage: 'group' | 'r16' | 'qf' | 'sf' | 'final' | 'third_place';
  stage_label: string;    // human label: "Group A · MD2", "Round of 16", "Quarter-final", …
  group: 'A'|…|'L'|null;  // group letter; null for knockouts
  md: 1 | 2 | 3 | null;   // matchday; null for knockouts

  home: string;           // Team.short
  away: string;           // Team.short
  hs: number | undefined; // home score — see §8 for precedence
  as: number | undefined; // away score
  pens: { hs: number; as: number } | undefined; // shootout score, only if has_penalty_shootout
  has_et: boolean;        // true if regulation went to extra time
  has_pens: boolean;      // true if a shootout occurred

  status: 'SCHED' | 'LIVE' | 'HT' | 'FT' | 'PP' | 'CXL';
  minute: string | undefined; // e.g., "67'", only when LIVE/HT

  venue: string;          // Venue.short
  kickoff_iso: string;    // canonical, ISO 8601 UTC. e.g., "2026-06-19T19:00:00Z"
}
```

**What's gone from today's shape:**

- `date: 'Jun 19'` — removed from the data model. It's a render concern derived from `kickoff_iso` per-viewer locale. See §6.
- `kickoff: '3:00 PM ET'` — removed from the data model. Same reason. UI selectors compute it from `kickoff_iso`.

**What's new:**

- `season`, `stage`, `stage_label`, `kickoff_iso`, `pens`, `has_et`, `has_pens`.

**Compat strategy.** During the migration, the gateway can emit a "compat" view that adds back `{ date, kickoff }` derived server-side using a default locale (`en-US`, `America/New_York`), to unblock components that haven't been touched yet. The compat view is opt-in via the query parameter `?shape=v1` and is deleted at the end of the migration.

### 2.5 `Standing`

```ts
interface Standing {
  team: string;  // Team.short
  pld: number;   // played
  w: number;
  d: number;
  l: number;
  gf: number;    // goals for
  ga: number;    // goals against
  gd: number;    // goal difference
  pts: number;
}
```

Unchanged from today. **Source preference:**

1. **Primary**: server-provided rows from `GET /group_standings` (ALL-STAR tier), mapped through `mapStanding`. These are authoritative because they encode FIFA tiebreakers we don't replicate.
2. **Fallback**: client-side `computeStandings(group, matches)`, identical algorithm in both `src/api/scores.js` (kept) and `functions/src/scoring/compute-standings.ts` (new, mirror). Server fallback is used when upstream returns 5xx or when the tier is unavailable.

The client helper is retained only as a defensive fallback for offline rendering of cached match data; in normal operation the client receives Standings precomputed by the gateway.

### 2.6 `Lineup`

```ts
interface PlayerRef {
  id: number;       // upstream FIFAPlayer.id
  n: number | null; // shirt number; null if upstream omits
  name: string;     // FIFAPlayer.short_name if present, else FIFAPlayer.name
  position: string | null; // "GK" | "DF" | "MF" | "FW" | upstream value
}

interface Lineup {
  team: string;       // Team.short
  formation: string;  // e.g., "4-3-3"; falls back to "4-3-3" if upstream omits — see §2.8
  starters: PlayerRef[]; // length 11; ordered by position when possible
  subs: PlayerRef[];     // bench
  coach: string;         // manager full name; "" if upstream omits
}
```

**Compat note.** Today's `LINEUPS[short]` keyed map continues to work because the gateway emits `lineups: { [short]: Lineup }` inside `matchDetails/{id}`.

### 2.7 `MatchEvent` (timeline entry)

We project upstream's `incident_type` × `incident_class` matrix into a discriminated union keyed on `type`. The UI only knows about these `type` strings.

```ts
type MatchEvent =
  | { type: 'goal';          min: string; team: string; player: string; assist?: string; score: string }
  | { type: 'own_goal';      min: string; team: string; player: string;                 score: string }
  | { type: 'penalty_goal';  min: string; team: string; player: string;                 score: string }
  | { type: 'yellow';        min: string; team: string; player: string }
  | { type: 'red';           min: string; team: string; player: string }
  | { type: 'second_yellow'; min: string; team: string; player: string }
  | { type: 'sub';           min: string; team: string; playerOff: string; playerOn: string }
  | { type: 'half';          min: string }
  | { type: 'full';          min: string }
  | { type: 'et_start';      min: string }
  | { type: 'et_half';       min: string }
  | { type: 'et_full';       min: string }
  | { type: 'pen_start';     min: string }
  | { type: 'shootout_kick'; min: string; team: string; player: string; scored: boolean; sequence: number };
```

The mapper takes the time-ordered FIFAMatchEvent list and emits a time-ordered MatchEvent list. Events that are not representable in the simpler UI (e.g., `incident_type: 'injuryTime'`) are **dropped**. Events that are rescinded (`rescinded: true`) are **dropped**.

### 2.8 `MatchStats`

```ts
interface MatchStats {
  // canonical labels — exact strings, exact order
  stats: {
    'Possession': [number, number];
    'Shots': [number, number];
    'On target': [number, number];
    'Corners': [number, number];
    'Fouls': [number, number];
    'Pass acc%': [number, number];
    'xG'?: [number, number]; // optional — see flag below
  };
  flags: {
    show_xg: boolean; // true when expected_goals is present for both sides
  };
}
```

Label → upstream mapping is in §3.6. **Backwards compat**: today's UI iterates `Object.entries(stats)` and renders a row per label, so adding the optional `xG` row is non-breaking. Components that want to hide xG when `show_xg === false` should skip the label rather than depending on the absence of the key.

### 2.9 `MatchDetails`

The single composite document. See §9 for the assembly path.

```ts
interface MatchDetails {
  matchId: string;
  lineups: { [teamShort: string]: Lineup };
  events: MatchEvent[];
  stats: MatchStats;
  fans: number | null;        // attendance; null if upstream omits
  _source: SourceEnvelope;    // stripped at gateway
}
```

`fans` corresponds to the attendance figure. Upstream does not currently expose attendance per match; until they do, this is `null` and the existing `fans: 11200` mock data is replaced by `null` in the live shape. The UI must tolerate `null` here (skip rendering, do not coerce to 0).

### 2.10 `Formation`

Formation coordinates remain a **client-side constant**. The API gives us a *formation name* (`"4-3-3"`); rendering coordinates is a UI concern.

```ts
// src/api/formations.js
const FORMATIONS = {
  '4-3-3':   [/* 11x {x,y} on 100x100 grid */],
  '4-2-3-1': [...],
  '3-5-2':   [...],
  '4-4-2':   [...],
  '5-3-2':   [...],
  '3-4-3':   [...],
};

function getFormationCoords(name) {
  return FORMATIONS[name] || FORMATIONS['4-3-3']; // fallback
}
```

Mappers never touch `FORMATIONS`. The mapper for `Lineup` propagates whatever string upstream sent, normalised to the `N-N-N` or `N-N-N-N` patterns the client knows. If the upstream string is malformed (e.g., `"4-3-3 "` with trailing whitespace), the mapper trims it. If it's missing, the mapper sets `formation: '4-3-3'` (the fallback). The mapper logs a warning when it falls back.

---

## 3. Field-by-field mapping tables

These tables are the implementation reference. Every row is `(upstream field → internal field, transform, notes)`. The mapper module is named in the section heading.

### 3.1 `mapTeam` — `functions/src/mappers/team.ts`

Source: `GET /fifa/worldcup/v1/teams` → `FIFATeam`.

| Upstream field | Internal field | Transform | Notes |
|---|---|---|---|
| `id` | `id` | identity (integer) | Stable upstream id. |
| `name` | `name` | identity | Display name. |
| `abbreviation` | `short` | `s => s ? s.toUpperCase() : deriveShortFromName(name)` | See §5 for derivation. |
| `country_code` | `code` | `c => c ? c.toLowerCase() : ''` | For flagcdn. ISO-2. |
| `confederation` | `confederation` | `c => c ?? ''` | One of the six FIFA confederations or empty. |
| — | — | — | The mapper additionally consults `team-overrides.ts` (see §5) by upstream `id`. |

**Override hook.** After the identity mapping, apply `applyTeamOverride(team)` which:
1. Looks up `OVERRIDES_BY_ID[team.id]` and shallow-merges its fields onto `team`.
2. Returns the merged team.

Example override entries (illustrative; populate after fixture capture):

```ts
const OVERRIDES_BY_ID: Record<number, Partial<Team>> = {
  // Scotland: flagcdn wants `gb-sct`, not `gb`.
  /* SCO_ID */ 0: { code: 'gb-sct' },
  // England: same family.
  /* ENG_ID */ 0: { code: 'gb-eng' },
  // Wales:
  /* WAL_ID */ 0: { code: 'gb-wls' },
};
```

### 3.2 `mapStadium` — `functions/src/mappers/stadium.ts`

Source: `GET /fifa/worldcup/v1/stadiums` → `FIFAStadium`.

| Upstream field | Internal field | Transform | Notes |
|---|---|---|---|
| `id` | `id` | identity (integer) | |
| `name` | `name` | identity | |
| `city` | `city` | `c => c ?? ''` | |
| `country` | `country` | `c => c ?? ''` | Upstream returns a country code or name — keep verbatim and let the UI decide. |
| `capacity` | `capacity` | `c => c ?? null` | |
| `latitude`, `longitude` | — | dropped | Not used by the UI today. |
| — | `short` | `synthesiseVenueShort(name, city, id)` | See §5.3. |

The `short` field is **synthesised** because upstream has no analogue. The mapper guarantees uniqueness across the season.

### 3.3 `mapMatch` — `functions/src/mappers/match.ts`

Source: `GET /fifa/worldcup/v1/matches` → `FIFAMatch`.

| Upstream field | Internal field | Transform | Notes |
|---|---|---|---|
| `id` | `id` | `String(id)` | Stringly typed on the wire. |
| `season.year` (via `season` object) | `season` | `s => Number(s.year)` | 2018 / 2022 / 2026. |
| `stage.name` | `stage` | `mapStage(s.name)` | See table §7.1. |
| `stage.name` | `stage_label` | `mapStageLabel(s, group, round_name)` | "Group A · MD2", "Round of 16", … |
| `group.name` | `group` | `g => g ? g.name : null` | Letter A..L. Null for knockouts. |
| `round_number` | `md` | `n => stage==='group' ? n : null` | Matchday only meaningful for group. |
| `round_name` | (used in `stage_label`) | — | "Round of 16", "Quarter-final", … |
| `datetime` | `kickoff_iso` | identity (already ISO 8601 UTC) | |
| `status` | `status` | `mapStatus(s, datetime)` | See §4. |
| — | `minute` | `deriveMinute(status, datetime, events)` | Derived; see §3.3.1. |
| `stadium.id` | `venue` | look up `Venue.short` by id | The mapper takes a `venuesByUpstreamId` map as a second arg. |
| `home_team.id` | `home` | look up `Team.short` by id | Takes `teamsByUpstreamId` as a second arg. |
| `away_team.id` | `away` | look up `Team.short` by id | |
| `home_score` + `extra_time_home_score` | `hs` | see §8 precedence | |
| `away_score` + `extra_time_away_score` | `as` | see §8 precedence | |
| `home_score_penalties`, `away_score_penalties` | `pens` | `(h,a) => (h!=null && a!=null) ? {hs:h, as:a} : undefined` | |
| `has_extra_time` | `has_et` | `b => !!b` | |
| `has_penalty_shootout` | `has_pens` | `b => !!b` | |
| `home_formation`, `away_formation` | — | not on `Match`; surfaced via `Lineup.formation` | |
| `referee`, `home_manager`, `away_manager` | — | dropped from `Match` | Manager surfaces via `Lineup.coach`. |
| `match_number`, `home_team_source`, `away_team_source` | — | dropped | Bracket-source labels can come back in v3 if needed. |
| `first_half_*`, `second_half_*` | — | dropped | Available via the events timeline (`type: 'half'`). |

#### 3.3.1 Deriving `minute`

`minute` is only set when `status ∈ {LIVE, HT}`. The rule:

- `HT`: `minute = "HT"`.
- `LIVE`: prefer the latest event's `time_minute` plus `added_time` if any → format `"67'"` or `"45+2'"`. If no events yet, fall back to `floor((now - kickoff_iso) / 60s)` clamped to `[1, 90]`.

`SCHED` and `FT` matches have `minute: undefined`.

### 3.4 `mapLineup` — `functions/src/mappers/lineup.ts`

Source: `GET /fifa/worldcup/v1/match_lineups` → `FIFAMatchLineup[]`.

The upstream returns **one row per player per match**. We **group** by `(match_id, team_id)`, then by `is_starter`:

| Upstream field | Internal field | Transform | Notes |
|---|---|---|---|
| `match_id` | (key, not stored) | identity | Used to bucket. |
| `team_id` | `Lineup.team` | look up `Team.short` by id | |
| `formation` (from any row in the bucket; or from `FIFAMatch.home_formation`/`away_formation` if upstream omits per-lineup) | `Lineup.formation` | first non-null wins | Fallback `"4-3-3"`. |
| `player.id` | `PlayerRef.id` | identity | |
| `shirt_number` | `PlayerRef.n` | `n => n ?? null` | |
| `player.short_name` ?? `player.name` | `PlayerRef.name` | identity | Prefer short_name for UI density. |
| `position` | `PlayerRef.position` | identity | Upstream string, e.g., "GK". |
| `is_starter === true` | → `Lineup.starters[]` | bucketing | Length 11 expected; mapper warns if not. |
| `is_substitute === true` (or `is_starter === false`) | → `Lineup.subs[]` | bucketing | |
| — | `Lineup.coach` | from `FIFAMatch.home_manager.name` or `away_manager.name` (passed in) | The lineup mapper takes the parent `FIFAMatch` as context so it can attach the manager. |

**Edge case.** If a player appears in both `is_starter: true` and `is_substitute: true` (theoretically impossible), starter wins; sub entry is dropped; mapper logs a warning.

### 3.5 `mapEvents` — `functions/src/mappers/event.ts`

Source: `GET /fifa/worldcup/v1/match_events` → `FIFAMatchEvent[]`.

The mapper iterates upstream events in time order and emits a `MatchEvent` per entry, applying these rules:

#### 3.5.1 The discriminator table

`type` is decided from `(incident_type, incident_class)`:

| upstream `incident_type` | upstream `incident_class` | internal `type` | Notes |
|---|---|---|---|
| `goal` | `regular` | `goal` | |
| `goal` | `own_goal` | `own_goal` | |
| `goal` | `penalty` | `penalty_goal` | |
| `goal` | `header` | `goal` | Collapsed; header detail dropped. |
| `goal` | `volley` | `goal` | Collapsed. |
| `card` | `yellow` | `yellow` | |
| `card` | `red` | `red` | |
| `card` | `second_yellow` (or `yellow_red`) | `second_yellow` | Accept either upstream class. |
| `substitution` | (any) | `sub` | |
| `period` | `first_half_end` | `half` | |
| `period` | `second_half_end` | `full` | |
| `period` | `extra_time_first_half_start` | `et_start` | |
| `period` | `extra_time_first_half_end` | `et_half` | |
| `period` | `extra_time_second_half_end` | `et_full` | |
| `period` | `penalty_shootout_start` | `pen_start` | |
| `penaltyShootout` | (any) | `shootout_kick` | `scored` = `incident_class === 'scored'`. |
| `injuryTime` | (any) | — | Dropped. UI shows "+N" via `min`. |
| any with `rescinded: true` | (any) | — | Dropped. |

#### 3.5.2 Field mapping per emitted event

| Upstream field | Internal field | Transform | Notes |
|---|---|---|---|
| `time_minute` (+ optional `added_time`) | `min` | `(t, a) => a ? \`${t}+${a}'\` : \`${t}'\`` | Trailing `'`. For `half`/`full`/`et_*`/`pen_start` use `"45'"`, `"90'"`, etc. |
| `is_home` | `team` | `b => b ? home_short : away_short` | The mapper takes the parent match's `home`/`away` shorts. |
| `player.short_name` ?? `player.name` | `player` | identity | |
| `assist_player.short_name` ?? `assist_player.name` | `assist` | only on `goal` and `penalty_goal` types | |
| `player_out.short_name` ?? `player_out.name` | `playerOff` | only on `sub` | |
| `player_in.short_name` ?? `player_in.name` | `playerOn` | only on `sub` | |
| `home_score` + `away_score` | `score` | `\`${h}-${a}\`` | Only on goal types. Reflects post-event running score. |
| `shootout_sequence` | `sequence` | identity | Only on `shootout_kick`. |
| `incident_class === 'scored'` | `scored` | derived bool | Only on `shootout_kick`. |

### 3.6 `mapTeamMatchStats` — `functions/src/mappers/team-stats.ts`

Source: `GET /fifa/worldcup/v1/team_match_stats` → `FIFATeamMatchStats[]`.

Upstream returns **two rows per match** (one per team, distinguished by `is_home`). The mapper takes both and assembles a single `MatchStats` for the match.

#### 3.6.1 Canonical label → upstream field

| Internal label | Upstream field (home) | Upstream field (away) | Transform | Notes |
|---|---|---|---|---|
| `Possession` | `possession_pct` | `possession_pct` | `(h,a) => [h ?? 0, a ?? 0]` | 0–100. |
| `Shots` | `shots_total` | `shots_total` | `(h,a) => [h ?? 0, a ?? 0]` | |
| `On target` | `shots_on_target` | `shots_on_target` | `(h,a) => [h ?? 0, a ?? 0]` | |
| `Corners` | `corners` | `corners` | `(h,a) => [h ?? 0, a ?? 0]` | |
| `Fouls` | `fouls` | `fouls` | `(h,a) => [h ?? 0, a ?? 0]` | |
| `Pass acc%` | `passes_total` + `passes_accurate` | same | `(t,a) => Math.round(100 * a / t)` for each side; 0 if `t==0` | Derived as a percentage. |
| `xG` (optional) | `expected_goals` | `expected_goals` | `(h,a) => [round(h,2), round(a,2)]` | Only included when both sides have non-null. |

#### 3.6.2 `flags`

| Field | Rule |
|---|---|
| `show_xg` | `home.expected_goals != null && away.expected_goals != null` |

If `show_xg === false`, the mapper **omits** the `xG` key from `stats` rather than emitting `[0,0]`. Components must therefore use the `flags.show_xg` boolean to know whether to render the row.

### 3.7 `mapStanding` — `functions/src/mappers/standing.ts`

Source: `GET /fifa/worldcup/v1/group_standings` → `FIFAStanding[]`.

| Upstream field | Internal field | Transform | Notes |
|---|---|---|---|
| `team.id` | `team` | look up `Team.short` by id | |
| `played` | `pld` | identity | |
| `won` | `w` | identity | |
| `drawn` | `d` | identity | |
| `lost` | `l` | identity | |
| `goals_for` | `gf` | identity | |
| `goals_against` | `ga` | identity | |
| `goal_difference` | `gd` | identity | Trust upstream rather than recompute. |
| `points` | `pts` | identity | |
| `position` | (used for ordering) | sort by ascending | Emitted Standings array is in position order. |
| `group.name` | (key, not stored on the row) | identity | The mapper returns `{ [groupId]: Standing[] }`. |

---

## 4. Status enum mapping

Upstream `FIFAMatch.status` strings → internal `Match.status`.

| Upstream `status` | Internal `status` | Conditions / notes |
|---|---|---|
| `scheduled` | `SCHED` | Default before kickoff. |
| `in_progress` | `LIVE` | Generic in-progress. Refined to `HT` if the most recent event is `period: first_half_end` and no `period: second_half_start` exists. |
| `in_progress` | `HT` | As above, refined by event inspection. If events aren't available (e.g., free tier), accept `LIVE`. |
| `completed` | `FT` | Full-time, regardless of whether it went to ET or pens. |
| `postponed` | `PP` | |
| `cancelled` | `CXL` | |
| (anything else) | `SCHED` | Defensive default; mapper logs a warning. |

```ts
function mapStatus(upstream: string, datetimeIso: string, events?: FIFAMatchEvent[]): InternalStatus {
  switch (upstream) {
    case 'scheduled': return 'SCHED';
    case 'completed': return 'FT';
    case 'postponed': return 'PP';
    case 'cancelled': return 'CXL';
    case 'in_progress':
      return isAtHalfTime(events) ? 'HT' : 'LIVE';
    default:
      console.warn('mapStatus: unknown upstream status', upstream);
      return 'SCHED';
  }
}
```

`isAtHalfTime(events)` returns true iff the latest period-event is `first_half_end` and no `second_half_start` follows.

---

## 5. Short-code derivation

### 5.1 Team short codes

Decision tree, executed in order:

1. **Override table.** If `OVERRIDES_BY_ID[upstream.id].short` is defined, use it. (Currently empty; populated only if upstream's `abbreviation` clashes with an internal code we want to preserve.)
2. **Upstream `abbreviation`.** If non-empty, uppercase it. This is the common path; balldontlie uses FIFA-style 3-letter codes.
3. **Derive from `name`.** Take the first three letters of the upstream `name`, uppercased, stripping diacritics and non-letters. `"Côte d'Ivoire"` → `"COT"`. The mapper logs a warning when it derives.

```ts
function teamShortFromUpstream(t: FIFATeam): string {
  const override = OVERRIDES_BY_ID[t.id]?.short;
  if (override) return override;
  if (t.abbreviation) return t.abbreviation.toUpperCase();
  console.warn('teamShortFromUpstream: deriving from name', t);
  return deriveShortFromName(t.name);
}

function deriveShortFromName(name: string): string {
  return name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // strip diacritics
    .replace(/[^A-Za-z]/g, '')
    .slice(0, 3).toUpperCase();
}
```

### 5.2 Team flag codes

`code` (the ISO-2 lowercase used by flagcdn) usually comes from `country_code`. Overrides exist for the UK home nations:

| Team | Upstream country_code | Internal code | Reason |
|---|---|---|---|
| Scotland | `gb` | `gb-sct` | flagcdn supports subdivision codes. |
| England | `gb` | `gb-eng` | |
| Wales | `gb` | `gb-wls` | |
| Northern Ireland | `gb` | `gb-nir` | |

The override lives in the same `team-overrides.ts` (`OVERRIDES_BY_ID[id].code`).

### 5.3 Venue short codes

Upstream has no `abbreviation` for stadiums. We synthesise. Strategy:

```ts
function synthesiseVenueShort(name: string, city: string, id: number): string {
  // 1) static override table (open question §14: should we maintain one?)
  if (VENUE_SHORT_BY_ID[id]) return VENUE_SHORT_BY_ID[id];

  // 2) derive from name: take first letter of first three words.
  const fromName = name.split(/\s+/).slice(0, 3).map(w => w[0]).join('').toUpperCase();
  if (fromName.length === 3) return fromName;

  // 3) derive from city: first three letters.
  return deriveShortFromName(city);
}
```

**Uniqueness is enforced post-derivation**: the gateway runs `dedupeVenueShorts(venues)` which appends `2`, `3`, … to any collision (in upstream id order).

The static `VENUE_SHORT_BY_ID` table is the recommended path for 2026 stadiums where designers have already picked codes (e.g., `AZT` for Azteca, `MIA` for Hard Rock). We seed it from `src/api/mock-data.js` during the migration so existing screens don't change.

---

## 6. Date and time handling

### 6.1 Source of truth

- `kickoff_iso` is the **only canonical time field** on a Match.
- It is ISO 8601 UTC, copied verbatim from upstream `datetime`.
- All display strings (`"Jun 19"`, `"3:00 PM ET"`, `"19/6"` for international locales) are derived **on the client**, in render code or selectors.

### 6.2 What's removed

| Old field | Replacement | Where |
|---|---|---|
| `date: 'Jun 19'` | `formatShortDate(kickoff_iso, userTz)` | A selector in `src/api/format.js` (new). |
| `kickoff: '3:00 PM ET'` | `formatKickoff(kickoff_iso, userTz)` | Same. |

Both selectors take an explicit timezone so the existing `formatShortDate(getNow())` "clock-controlled date" pattern continues to work: the test harness can pass a fake `userTz` or pin the user's locale.

### 6.3 Compat shim

During the migration window, the gateway can return `date` and `kickoff` derived for `en-US`/`America/New_York` by setting query parameter `?shape=v1`. The shim is deleted once all components consume `kickoff_iso`. The shim is implemented in `functions/src/gateway/compat-v1.ts` and is tested with a fixture that snapshots both shapes.

---

## 7. Stage and matchday handling

### 7.1 Stage discriminator

Upstream `FIFAStage.name` strings → internal `stage`:

| Upstream `stage.name` | Internal `stage` | Internal `stage_label` template |
|---|---|---|
| `group_stage` (or `group`) | `group` | `"Group {group} · MD{md}"` e.g. "Group A · MD2" |
| `round_of_16` | `r16` | `"Round of 16"` |
| `quarter_finals` | `qf` | `"Quarter-final"` |
| `semi_finals` | `sf` | `"Semi-final"` |
| `third_place_playoff` | `third_place` | `"Third-place playoff"` |
| `final` | `final` | `"Final"` |

If upstream is null (e.g., bracket not drawn), set `stage: null` and `stage_label: "TBD"`. See open question §14.

### 7.2 Matchday assignment

`md` is **only** set when `stage === 'group'`. The mapper uses `FIFAMatch.round_number` (1, 2, 3 for the three group rounds). For knockouts, `md` is `null`.

### 7.3 Stage label rendering

`stage_label` is computed in the mapper because the rule depends on `group` and `md` together, and we want the same label everywhere (fixture lists, schedule pages, share cards). The UI must not re-derive it.

---

## 8. Score handling across periods

Upstream splits scores into multiple fields. The internal `hs`/`as` is the **current score that should be displayed in the scoreline component**.

### 8.1 Precedence rule

In order of precedence (first match wins):

1. **`status === 'SCHED'`** → `hs = as = undefined`. No scores yet.
2. **`status === 'LIVE'` or `'HT'`** → `hs = home_score`, `as = away_score`. Live tally.
3. **`status === 'FT'` and `has_extra_time === true`** → `hs = home_score + (extra_time_home_score ?? 0)`. Same for away. (Upstream `home_score`/`away_score` is regulation-only; ET adds on.)
4. **`status === 'FT'` and `has_extra_time === false`** → `hs = home_score`, `as = away_score`. Regulation full-time.
5. **`status === 'PP'` or `'CXL'`** → if any goals were scored, use rule 2; else `undefined`.

> Wait — the upstream contract for `home_score` after ET is ambiguous. The mapper assumes `home_score` is *regulation only* and `extra_time_home_score` is *the ET goals only*. This must be verified against fixtures (see open question §14). Until verified, the mapper has a `// TBD verify` comment and a fixture-driven assertion.

### 8.2 Penalties

Penalties **never** add to `hs`/`as`. They live exclusively in `pens`:

```ts
match.pens = (home_score_penalties != null && away_score_penalties != null)
  ? { hs: home_score_penalties, as: away_score_penalties }
  : undefined;
```

If `has_penalty_shootout` is true but the score values are null, set `pens: undefined` and log a warning. The scoreline component renders pens via `match.pens` separately, e.g., "ARG 3–3 FRA (4–2 pen)".

### 8.3 Examples

| Scenario | `home_score` | `extra_time_home_score` | `home_score_penalties` | `has_et` | `has_pens` | Internal `hs` | Internal `pens.hs` |
|---|---|---|---|---|---|---|---|
| Regulation 2–1 home win | 2 | null | null | false | false | 2 | — |
| 2–2 after 90, 1–0 in ET, home wins | 2 | 1 | null | true | false | 3 | — |
| 1–1 after 90, 0–0 in ET, home wins on pens 4–2 | 1 | 0 | 4 | true | true | 1 | 4 |
| Live, 1–0 to home at 67' | 1 | null | null | null | null | 1 | — |
| Scheduled | null | null | null | null | null | undefined | — |

---

## 9. Match details composition

`MatchDetails` is the only Firestore document that aggregates multiple upstream resources. Define a server-side composite called `getMatchDetails(matchId)`:

```ts
async function getMatchDetails(matchId: string): Promise<MatchDetails> {
  const [lineupsRaw, eventsRaw, statsRaw, matchRaw] = await Promise.all([
    upstream.get('/match_lineups',     { match_ids: [matchId] }),
    upstream.get('/match_events',      { match_ids: [matchId] }),
    upstream.get('/team_match_stats',  { match_ids: [matchId] }),
    upstream.get('/matches',           { match_ids: [matchId] }),
  ]);

  const match = mapMatch(matchRaw.data[0], { teamsByUpstreamId, venuesByUpstreamId });
  const lineups = mapLineups(lineupsRaw.data, matchRaw.data[0], { teamsByUpstreamId });
  const events = mapEvents(eventsRaw.data, match);
  const stats = mapTeamMatchStats(statsRaw.data, match);

  return {
    matchId,
    lineups,
    events,
    stats,
    fans: null, // upstream does not currently expose attendance
    _source: {
      fetched_at: new Date().toISOString(),
      etag: null,
      tier_required: 'goat',
      schema: 'v2',
    },
  };
}
```

This is written to Firestore at `matchDetails/{matchId}` and read by the client through the gateway. The gateway strips `_source` on read.

**Refresh cadence** for `matchDetails`:
- Live: every 30s while `status ∈ {LIVE, HT}`.
- Post-match: once at FT, then never (the doc is frozen).
- Scheduled: lazily on first request, then never until status flips to LIVE.

(See `01-architecture.md` §refresh-cadences for the canonical cadence table.)

**Failure modes.**
- If `match_lineups` fails (5xx or tier denied), the composite still returns `MatchDetails` with `lineups: {}` and a `flags.partial: true` field (proposed addition — see open question §14).
- Similarly for `events` and `stats`.
- The composite never throws; it always returns a `MatchDetails` with as many parts as available. The gateway logs partial assemblies.

---

## 10. Standings fallback

### 10.1 The algorithm (canonical)

Used by both the client (`src/api/scores.js`, retained) and the server fallback (`functions/src/scoring/compute-standings.ts`).

```js
function computeStandings(group, matches) {
  const rows = {};
  for (const t of group.teams) rows[t] = { team: t, pld:0, w:0, d:0, l:0, gf:0, ga:0, gd:0, pts:0 };

  for (const m of matches) {
    if (m.status !== 'FT') continue;       // only completed matches count
    if (m.group !== group.id) continue;    // belongs to this group
    if (!(m.home in rows) || !(m.away in rows)) continue;

    const h = rows[m.home], a = rows[m.away];
    h.pld++; a.pld++;
    h.gf += m.hs; h.ga += m.as;
    a.gf += m.as; a.ga += m.hs;

    if (m.hs > m.as)       { h.w++; a.l++; h.pts += 3; }
    else if (m.hs < m.as)  { a.w++; h.l++; a.pts += 3; }
    else                   { h.d++; a.d++; h.pts++; a.pts++; }
  }

  for (const r of Object.values(rows)) r.gd = r.gf - r.ga;

  // Tiebreakers: pts desc, gd desc, gf desc, team alpha asc.
  return Object.values(rows).sort((x, y) =>
    y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || x.team.localeCompare(y.team)
  );
}
```

### 10.2 Tiebreakers

The fallback uses **points → goal difference → goals for → team short alphabetical**. This is intentionally simpler than FIFA's official tiebreakers (which include head-to-head, fair play, drawing of lots). The fallback is best-effort; the **primary** path is upstream `/group_standings`, which encodes FIFA's full tiebreaker order.

When the client renders standings, it must label the source: `Standing.source ∈ { 'upstream' | 'fallback' }`. The gateway adds this field. UI may display a small "approximate" badge when source is `fallback`.

### 10.3 When fallback kicks in

| Condition | Action |
|---|---|
| Upstream `/group_standings` returns 200 | Use upstream rows; `source: 'upstream'`. |
| Upstream returns 5xx | Use fallback; `source: 'fallback'`. Log error. |
| Upstream returns 403 (tier denied) | Use fallback; `source: 'fallback'`. Log warning once per cold start. |
| Upstream rate-limited (429) | Use fallback; `source: 'fallback'`. Respect Retry-After before next attempt. |
| Cache exists and is < 5 min old | Skip upstream; serve cache. |

---

## 11. Versioning and evolution

### 11.1 Schema discriminator

Every Firestore document includes `_source.schema: 'v2'`. When we change an internal shape:

1. Bump to `'v3'` in `types.ts`.
2. Add a migration function in `functions/src/mappers/migrations/v2-to-v3.ts`.
3. The gateway reads `_source.schema`; if it sees a stale schema, it re-fetches and re-maps.
4. Add a `docs/plan/CHANGELOG.md` entry describing the field-level diff.

Field additions that are non-breaking (e.g., new optional fields) do **not** require a schema bump. Field removals, renames, and type changes do.

### 11.2 Mapper purity

Mappers are **pure functions**. They:
- Do not read from Firestore.
- Do not call the network.
- Do not read `Date.now()` (except via an injected clock).
- Do not mutate their inputs.

This makes them trivially testable: `expect(mapMatch(fixture)).toEqual(expectedInternal)`.

### 11.3 Lookup maps as inputs

When a mapper needs cross-resource data (e.g., `mapMatch` needs to translate `home_team.id` → `Team.short`), it takes a lookup map as a **second argument**, not via a side channel:

```ts
function mapMatch(m: FIFAMatch, ctx: { teamsByUpstreamId: Map<number,Team>; venuesByUpstreamId: Map<number,Venue> }): Match
```

The handler is responsible for assembling `ctx` before calling the mapper. Fixtures include the `ctx` in JSON form for reproducibility.

### 11.4 Logging

Mappers use `console.warn` (Cloud Functions surfaces this to Cloud Logging) for *recoverable* anomalies (e.g., deriving a short code, missing optional field). They never throw on missing optional fields. They **do** throw on missing required fields (e.g., `FIFATeam.id` missing) because that indicates an upstream contract violation that the gateway should escalate.

---

## 12. Test fixtures

### 12.1 Capture procedure

1. With a test API key, run `pnpm capture-fixtures` (script to be added under `functions/scripts/capture-fixtures.ts`).
2. For each endpoint, the script makes one request with the canonical filter set (`seasons=[2026]`, etc.) and writes the raw response to `functions/test/fixtures/upstream/{endpoint}.json`.
3. The script **redacts** the `Authorization` header from any captured request metadata. Only response bodies are kept.

| Endpoint | Fixture file | Filter | Tier |
|---|---|---|---|
| `/teams` | `teams.json` | `seasons=[2026]` | free |
| `/stadiums` | `stadiums.json` | `seasons=[2026]` | free |
| `/group_standings` | `group_standings.json` | `seasons=[2026]` | all_star |
| `/matches` | `matches.json` | `seasons=[2026]` | goat |
| `/matches?match_ids` | `match_single.json` | `match_ids=[<one>]` | goat |
| `/match_lineups` | `match_lineups.json` | `match_ids=[<one>]` | goat |
| `/match_events` | `match_events.json` | `match_ids=[<one>]` | goat |
| `/team_match_stats` | `team_match_stats.json` | `match_ids=[<one>]` | goat |
| `/players` | `players.json` | `team_ids=[<one>]` | goat |
| `/rosters` | `rosters.json` | `seasons=[2026], team_ids=[<one>]` | goat |

### 12.2 Mapper test pattern

```ts
import fixture from '../fixtures/upstream/match_single.json';
import expected from '../fixtures/internal/match_single.expected.json';
import { mapMatch } from '../../src/mappers/match';
import { teamsByUpstreamId, venuesByUpstreamId } from '../fixtures/internal/lookups';

it('maps a regulation full-time match', () => {
  const out = mapMatch(fixture.data[0], { teamsByUpstreamId, venuesByUpstreamId });
  expect(out).toEqual(expected);
});
```

The expected file is hand-written *once* and reviewed in PR. After that, regenerating the expected file from a mapper change is a deliberate act (no auto-snapshot updates).

### 12.3 Client round-trip test

In `src/components/`, one component per shape gets a fixture-driven test that asserts it renders with the internal-shape fixture:

```js
import details from '../../functions/test/fixtures/internal/match_details.expected.json';
import { MatchDetailScreen } from './MatchDetailScreen.jsx';

it('renders MatchDetailScreen with live fixture', () => {
  const { container } = render(<MatchDetailScreen details={details} />);
  expect(container.querySelector('.scoreline')).toBeInTheDocument();
});
```

This catches drift between the mapper's expected output and the components' actual prop expectations.

### 12.4 Fixture refresh policy

Fixtures are **pinned**. We re-capture only when:
- Upstream announces a schema change.
- We add a new endpoint.
- We need a new edge case (e.g., a real ET+pens match) and the current fixture doesn't cover it.

Re-capture always lands as its own PR, with the fixture diff visible in review.

---

## 13. Cross-references

| This doc says… | …and it relates to |
|---|---|
| `_source` envelope, schema versioning (§1.4, §11.1) | `01-architecture.md` §cache-keys: cache key is `season + resource + filters` and the schema discriminator participates in invalidation. |
| Mappers are pure, take ctx as a second arg (§11.3) | `03-backend-functions.md` §handlers: each handler builds the ctx (lookup maps) before invoking the mapper. |
| `date`/`kickoff` dropped from `Match`, derived on client (§6.2) | `04-frontend-swap.md` §selectors: introduces `formatShortDate`/`formatKickoff` in `src/api/format.js`. |
| Compat shim `?shape=v1` (§6.3) | `04-frontend-swap.md` §migration-order: components opt into v2 in three waves. |
| `MatchDetails` composite (§9) | `01-architecture.md` §refresh-cadences: the only multi-source doc; cadence is driven by the parent match's status. |
| Standings preference (§2.5, §10) | `03-backend-functions.md` §standings: dual code path; client retains fallback for offline rendering. |

---

## 14. Open questions

These are unresolved at the time of writing. Each must be resolved before the mapper that depends on it is merged.

| # | Question | Impact | Resolution plan |
|---|---|---|---|
| 1 | Does balldontlie expose `expected_goals` in `team_match_stats` for 2018 and 2022, or only 2026? | The `xG` row in `MatchStats` may be empty for historical matches even though the field exists in the schema. | Capture `team_match_stats.json` for one 2018 and one 2022 match, inspect. Document in CHANGELOG. |
| 2 | For 2026, what does `FIFAMatch.stage.name` look like for KO matches *before* the bracket is drawn? | If upstream returns `null`, our `mapStage` falls through to `null` and `stage_label = "TBD"`. The schedule grid must tolerate null. | Confirm by inspecting a pre-draw `/matches` capture. If `null`, document. If a sentinel string, add to §7.1. |
| 3 | Should we maintain a static `VENUE_SHORT_BY_ID` table, or rely on synthesis + deduplication only? | Designer-chosen codes (`AZT`, `MIA`) preserve the existing UI; pure synthesis may produce surprising codes. | Recommend static table seeded from `mock-data.js`. Decision in §5.3. |
| 4 | Is upstream `home_score` after ET *regulation only* or *running total*? | Score precedence rule §8.1 depends on this. | Inspect a captured fixture where `has_extra_time: true`. Adjust §8.1 accordingly. Until verified, mappers carry `// TBD verify` and a fixture assertion. |
| 5 | Does upstream emit `incident_class: 'second_yellow'` or `'yellow_red'`? | The card discriminator table (§3.5.1) accepts both; if only one occurs, we can simplify. | Inspect captured `match_events.json`. |
| 6 | Does upstream provide attendance anywhere? | If yes, populate `MatchDetails.fans`. If no, `fans` stays `null`. | Check `/matches` response carefully; the OpenAPI spec does not currently list an attendance field. |
| 7 | Should the `flags.partial: true` field be added to `MatchDetails` for partial assemblies? (§9 failure modes) | UI affordance: show "details loading" rather than empty. | Decide once we have evidence of partial failures from the all_star/goat tiers. |
| 8 | UK home nations: does balldontlie list Scotland/Wales/Northern Ireland separately with distinct `country_code`s, or all as `gb`? | Determines whether the override table in §5.2 is needed or just a safety net. | Capture `/teams` for a tournament including a home nation (Scotland 1998, etc.) and inspect. |

---

*End of 02-data-contracts.md.*
