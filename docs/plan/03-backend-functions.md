# 03 — Backend: Cloud Functions Implementation Spec

**Status:** spec · **Owner:** backend · **Last updated:** 2026-05-14
**Cross-refs:** `00-overview.md`, `01-architecture.md`, `02-data-contracts.md`,
`04-frontend-swap.md`, `05-secrets-ops.md`.

This document is the implementation spec for the Cloud Functions layer that
sits between the World Cup PWA and `api.balldontlie.io/fifa/worldcup/v1/*`.
It assumes the architectural decisions in `01-architecture.md` (cache-aside via
Firestore, scheduled writer for LIVE matches, GOAT-tier production, season
defaults to 2026, App Check enforced, key in Secret Manager). It does not
revisit those.

The audience is the engineer who will create the files. Where a value is
guessed from the OpenAPI summary rather than read directly, it is marked
**TBD verify**.

---

## 1. Goals & non-goals

### Goals

1. **Strongly typed handlers.** Every callable has a `zod`-validated input
   schema and a `Response<T>` output type that the client imports from a
   shared `@worldcup/types` package (or a generated `.d.ts` published with the
   functions bundle — see § 13).
2. **Single fetch path per resource.** One `upstream/client.ts` module owns
   every outbound HTTP call. Handlers, mappers, schedulers, and the seed
   script all go through it. No `fetch()` calls anywhere else.
3. **Idempotent scheduled writes.** A scheduler that runs twice within its
   interval (Cloud Scheduler retry, manual trigger, redeploy) produces the
   same Firestore state. No counters incremented in place, no append-only
   logs without dedup keys.
4. **Observable.** Every handler emits a single structured log line on exit
   with `handler, cache_hit, upstream_ms, total_ms, status, season, key,
   request_id`. Counters for cache hit ratio, tier-required responses, and
   upstream 5xx are exported to Cloud Monitoring.

### Non-goals

- A GraphQL gateway. Each resource is one callable; the composite handler
  (`getMatchDetails`) is the only place we fan out server-side.
- A subscriptions / WebSocket API. Realtime is Firestore snapshot listeners
  on docs the scheduler writes through.
- Edge caching (Cloudflare, Fastly). Firestore is the cache.
- Multi-region. `us-central1` only; document why in § 3.

---

## 2. Directory layout

```
functions/
  src/
    index.ts                     # exports every callable + every scheduler
    config.ts                    # env + secret reading, region/runtime opts
    upstream/
      client.ts                  # fetch wrapper, auth header, retry/backoff
      types.ts                   # upstream response types (mirror OpenAPI)
      errors.ts                  # UpstreamError + subclasses
    cache/
      firestore.ts               # generic get/set with TTL & freshness
      keys.ts                    # cache key builders (pure functions)
      mutex.ts                   # in-process per-key lock
    mappers/
      team.ts
      stadium.ts
      match.ts
      lineup.ts
      event.ts
      team-stats.ts
      standings.ts
      group.ts                   # synthesizes Group[] from teams + standings
    handlers/
      teams.ts                   # getTeams
      stadiums.ts                # getStadiums
      groups.ts                  # getGroups (synthesized)
      matches.ts                 # getMatches + getMatchById
      matchDetails.ts            # composite
      lineups.ts                 # getLineups
      standings.ts               # getStandings
      health.ts                  # uptime probe (onRequest, no App Check)
    schedulers/
      refreshLiveMatches.ts
      refreshFixtures.ts
      refreshStandings.ts
    middleware/
      appCheck.ts                # callable wrapper enforcing App Check
      rateLimit.ts               # per-UID token bucket
      logging.ts                 # withLogging(handler) decorator
      validate.ts                # zod input validation decorator
    util/
      ttl.ts                     # TTL table (cross-refs 01-architecture)
      time.ts                    # now(), parseISO, isLive
      requestId.ts               # extract or mint x-request-id
      sanitize.ts                # strip _source fields from responses
    schemas/
      inputs.ts                  # zod input schemas for every callable
      outputs.ts                 # response TS types
  test/
    fixtures/
      upstream/                  # JSON captured by record-fixtures script
        teams_2022.json
        matches_2022_live.json
        match_events_<id>.json
        ...
    mappers/                     # pure tests
      team.test.ts
      match.test.ts
      ...
    handlers/                    # integration tests under emulators
      matches.test.ts
      matchDetails.test.ts
      ...
    helpers/
      stubUpstream.ts            # replaces upstream/client with fixture replay
      emulator.ts                # firestore emulator bootstrap
  scripts/
    record-fixtures.ts           # hits real API with test key, writes fixtures
    seed.ts                      # populates Firestore from fixtures
  package.json
  tsconfig.json
  .eslintrc.json
  .env.local.example             # template; real .env.local is gitignored
```

### File roles

- **`index.ts`** — Pure re-export surface. No logic. Lists every callable
  and every scheduled function exactly once so `firebase deploy --only
  functions:getMatches` works.
- **`config.ts`** — Owns `defineSecret('BALLDONTLIE_API_KEY')`, the region
  constant, the per-handler `RuntimeOptions` presets (`HEAVY_READ`,
  `COMPOSITE`, `SCHEDULER`), and the upstream base URL. No imports from
  `handlers/`.
- **`upstream/client.ts`** — The only module that calls `fetch()`. Exports
  `request<T>(path, query)` and `paginate<T>(path, query)`. Wires retry,
  timeout, error translation.
- **`upstream/types.ts`** — TS interfaces mirroring the OpenAPI response
  shapes. Hand-written or generated by `openapi-typescript`; pick generation
  if it produces clean output, otherwise hand-write the dozen we use.
- **`upstream/errors.ts`** — `UpstreamError` base + `UpstreamAuthError`,
  `TierRequiredError`, `UpstreamBadRequest`, `UpstreamServerError`,
  `UpstreamTimeout`, `UpstreamRateLimited`. Each carries `status, path,
  request_id`.
- **`cache/firestore.ts`** — `getOrSet<T>(key, ttl, freshFn)`,
  `writeThrough<T>(key, value, ttl)`, `readFresh<T>(key)`. Wraps
  `admin.firestore()`.
- **`cache/keys.ts`** — `teamsKey(season)`, `matchesKey(args)`,
  `matchKey(id)`, etc. Pure string builders. Tested independently.
- **`cache/mutex.ts`** — Module-level `Map<string, Promise<unknown>>` that
  coalesces concurrent `getOrSet` calls for the same key within one instance.
- **`mappers/*.ts`** — `mapMatch(upstream: FIFAMatch): Match` etc. Pure
  functions. Output types from `02-data-contracts.md § Internal shape v2`.
- **`handlers/*.ts`** — Each exports a `functions.https.CallableFunction`
  (or array of them). Composed: `withAppCheck(withLogging(withValidate(...,
  schema)(handlerFn)))`.
- **`schedulers/*.ts`** — Each exports one `functions.scheduler.onSchedule`.
  No HTTP triggers.
- **`middleware/appCheck.ts`** — Thin wrapper that sets `enforceAppCheck:
  true` and `consumeAppCheckToken: true` on a `CallableOptions` object plus
  defensive check inside the handler for emulator bypass.
- **`middleware/rateLimit.ts`** — `withRateLimit(handler)` decorator. Reads
  `meta/rate_buckets/{uid}`, refills, decrements, rejects with
  `HttpsError('resource-exhausted', ...)`.
- **`middleware/logging.ts`** — `withLogging(handler, name)` decorator.
  Wraps the call in a try/finally, emits the structured log line on exit,
  attaches `request_id` to a continuation-local context.
- **`middleware/validate.ts`** — `withValidate(schema, handler)`. Parses
  `data` through a `zod` schema; on failure throws
  `HttpsError('invalid-argument', ...)` with the issue list.
- **`util/ttl.ts`** — Single source of truth for TTL values. Cross-refs
  `01-architecture.md § TTL table`.
- **`util/sanitize.ts`** — `stripInternal(doc)` removes any key prefixed
  with `_` (the Firestore docs carry `_source, _fetchedAt, _expiresAt`; the
  client never sees them).
- **`schemas/inputs.ts`** — `getMatchesInput`, `getMatchByIdInput`, etc.
  `zod` schemas; one per callable. Exports inferred TS types.
- **`schemas/outputs.ts`** — Response TS interfaces. Imported by client.

---

## 3. Configuration & secrets

### Secret

```ts
// config.ts
import { defineSecret } from 'firebase-functions/params';

export const BALLDONTLIE_API_KEY = defineSecret('BALLDONTLIE_API_KEY');
```

Binding pattern on every callable that needs it:

```ts
export const getMatches = onCall(
  { secrets: [BALLDONTLIE_API_KEY], ...HEAVY_READ },
  handler,
);
```

Local dev: `.env.local` carries `BALLDONTLIE_API_KEY=...`; the emulator reads
it via `process.env`. The upstream client checks
`BALLDONTLIE_API_KEY.value() || process.env.BALLDONTLIE_API_KEY` in that
order.

### Region

```ts
// config.ts
import { setGlobalOptions } from 'firebase-functions/v2';
setGlobalOptions({ region: 'us-central1', maxInstances: 50 });
```

`us-central1` because the default Firestore database (Native mode, `(default)`
location) lives there for this project. Same-region reads & writes are the
cheapest and lowest-latency. Re-evaluate only if we move Firestore.

### Runtime options

```ts
// config.ts
import type { CallableOptions } from 'firebase-functions/v2/https';

export const HEAVY_READ: CallableOptions = {
  region: 'us-central1',
  memory: '256MiB',
  timeoutSeconds: 60,
  minInstances: 1,        // applied only to getMatches, getMatchById, getMatchDetails
  maxInstances: 50,
  concurrency: 80,
  enforceAppCheck: true,
  consumeAppCheckToken: true,
};

export const LIGHT_READ: CallableOptions = {
  ...HEAVY_READ,
  minInstances: 0,
};

export const COMPOSITE: CallableOptions = {
  ...HEAVY_READ,
  memory: '512MiB',
};

export const SCHEDULER = {
  region: 'us-central1',
  memory: '512MiB',
  timeoutSeconds: 120,
};
```

`minInstances: 1` is applied only to the three handlers a user hits during a
live match (`getMatches`, `getMatchById`, `getMatchDetails`). Other handlers
accept a cold start.

`maxInstances: 50` is the cost cap. At GOAT tier we expect <5 concurrent
instances in steady state; 50 is headroom for a viral spike that we'd rather
serve cold than drop.

`concurrency: 80` keeps a single instance busy on cache hits (the hot path).

---

## 4. Upstream client

### Base URL & headers

```ts
// upstream/client.ts
const BASE_URL = 'https://api.balldontlie.io/fifa/worldcup/v1';
const TIMEOUT_MS = 10_000;

function authHeaders(): HeadersInit {
  const key = BALLDONTLIE_API_KEY.value() || process.env.BALLDONTLIE_API_KEY;
  if (!key) throw new UpstreamAuthError('no api key configured', 500, '');
  return { Authorization: key };
}
```

Auth header is the raw key, not `Bearer <key>` — balldontlie docs use the
former. **TBD verify** against a live 200 response on first integration.

### `request<T>`

```ts
export async function request<T>(
  path: string,
  query: Record<string, string | number | string[] | undefined> = {},
  opts: { retryOn5xx?: boolean; signal?: AbortSignal } = {},
): Promise<T> {
  const url = buildUrl(BASE_URL + path, query);
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let attempt = 0;

  try {
    while (true) {
      attempt++;
      let res: Response;
      try {
        res = await fetch(url, {
          headers: authHeaders(),
          signal: opts.signal ?? controller.signal,
        });
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          throw new UpstreamTimeout(path, Date.now() - start);
        }
        throw new UpstreamServerError(path, 0, String(err));
      }

      if (res.ok) return (await res.json()) as T;

      if (res.status === 401) throw new UpstreamAuthError(path, 401, await res.text());
      if (res.status === 402 || res.status === 403) {
        throw new TierRequiredError(path, res.status);
      }
      if (res.status === 429 && attempt === 1) {
        const wait = Math.min(2000, parseInt(res.headers.get('retry-after') ?? '1', 10) * 1000);
        await sleep(wait);
        continue;
      }
      if (res.status >= 500 && attempt === 1 && (opts.retryOn5xx ?? true)) {
        await sleep(200 + Math.random() * 200);
        continue;
      }
      if (res.status >= 500) throw new UpstreamServerError(path, res.status, await res.text());
      throw new UpstreamBadRequest(path, res.status, await res.text());
    }
  } finally {
    clearTimeout(timer);
  }
}
```

Notes:
- 1 retry on 5xx with 200–400 ms jitter, then propagate.
- 429: read `Retry-After`, sleep up to 2 s, retry once. Past that, propagate
  as `UpstreamRateLimited` (separate subclass — TBD verify which is more
  useful; for now treat as `UpstreamServerError` so callers fall through to
  stale-on-error).
- 401 → `UpstreamAuthError` (key rotation incident; alert via Cloud
  Monitoring on >0).
- 402/403 → `TierRequiredError` (handlers map this to `{ data: [],
  tier_required: true }`).
- 4xx other → `UpstreamBadRequest` (handler bug; alert).
- Network/timeout → `UpstreamTimeout` after 10 s.

### `paginate<T>`

```ts
export async function paginate<T>(
  path: string,
  query: Record<string, string | number | string[] | undefined> = {},
  opts: { maxPages?: number; perPage?: number } = {},
): Promise<T[]> {
  const maxPages = opts.maxPages ?? 10;
  const perPage = opts.perPage ?? 100;
  const out: T[] = [];
  let cursor: number | undefined;
  for (let i = 0; i < maxPages; i++) {
    const page = await request<{ data: T[]; meta: { next_cursor: number | null } }>(
      path,
      { ...query, per_page: perPage, cursor },
    );
    out.push(...page.data);
    if (page.meta.next_cursor == null) return out;
    cursor = page.meta.next_cursor;
  }
  logger.warn('paginate.bounded', { path, maxPages, collected: out.length });
  return out;
}
```

`maxPages: 10` hard cap. At `per_page: 100` that's 1000 rows per call, which
exceeds every single response we expect (64 matches max in a tournament). A
runaway `next_cursor` loop logs and returns what it has rather than burning
quota.

### Query encoding

`seasons[]=2022&seasons[]=2026` is the array form balldontlie uses. The URL
builder explodes any value that is an array into repeated `key[]=v` pairs.
**TBD verify** with an actual `/matches?seasons[]=2022` call — some
implementations want `seasons=2022,2026` instead.

---

## 5. Cache layer

### Collection layout

Per-resource collections, not a single `cache/*` bucket:

```
firestore/
  teams/{season}                       # one doc per season
  stadiums/{season}
  standings/{season}_{groupId}         # group "A" → A; null group → "_overall"
  matches/{matchId}                    # canonical per-match doc
  matchIndex/{season}                  # array of matchIds + status, for listing
  matchDetails/{matchId}               # composite (lineups + events + stats)
  lineups/{matchId}                    # raw lineups by match
  meta/
    scheduler_state                    # last_run_at, next_run_at, mode
    upstream_budget                    # daily counter, reset 00:00 UTC
    rate_buckets/{uid}                 # per-anon-UID token bucket
    cacheIndex                         # diagnostics: counts, hit ratio
```

Rationale: per-resource collections give us Firestore-native indexes,
straightforward security rules ("client may read `matches/*`, never
`meta/*`"), and per-collection TTL policies (Firestore TTL field
`_expiresAt` — see § 5.4).

### `getOrSet`

```ts
// cache/firestore.ts
export interface CachedDoc<T> {
  payload: T;
  _fetchedAt: Timestamp;
  _expiresAt: Timestamp;
  _schema: 'v2';
  _source: 'upstream' | 'stale-fallback';
}

export async function getOrSet<T>(
  collection: string,
  docId: string,
  ttlSeconds: number,
  freshFn: () => Promise<T>,
): Promise<{ value: T; cacheHit: boolean; stale: boolean }> {
  const ref = db.collection(collection).doc(docId);
  const snap = await ref.get();
  const now = Date.now();

  if (snap.exists) {
    const doc = snap.data() as CachedDoc<T>;
    if (doc._expiresAt.toMillis() > now) {
      return { value: doc.payload, cacheHit: true, stale: false };
    }
  }

  return mutex.run(`${collection}/${docId}`, async () => {
    // re-check after acquiring the lock
    const snap2 = await ref.get();
    const doc2 = snap2.exists ? (snap2.data() as CachedDoc<T>) : undefined;
    if (doc2 && doc2._expiresAt.toMillis() > now) {
      return { value: doc2.payload, cacheHit: true, stale: false };
    }

    try {
      const fresh = await freshFn();
      const expiresAt = Timestamp.fromMillis(now + ttlSeconds * 1000);
      await ref.set({
        payload: fresh,
        _fetchedAt: Timestamp.fromMillis(now),
        _expiresAt: expiresAt,
        _schema: 'v2',
        _source: 'upstream',
      } satisfies CachedDoc<T>);
      return { value: fresh, cacheHit: false, stale: false };
    } catch (err) {
      if (doc2) {
        logger.warn('cache.stale_fallback', { collection, docId, err: String(err) });
        return { value: doc2.payload, cacheHit: true, stale: true };
      }
      throw err;
    }
  });
}
```

Semantics:
- Hit and not expired → return payload, `cacheHit: true`.
- Miss or expired → run `freshFn`, write through, return.
- `freshFn` throws and a stale doc exists → return stale, log warning.
- `freshFn` throws and no doc exists → propagate (handler decides whether
  to soft-empty).

### Stampede protection

```ts
// cache/mutex.ts
const inflight = new Map<string, Promise<unknown>>();

export async function run<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = fn().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}
```

In-process only. A scheduler firing while a user request is also missing the
cache may still produce two upstream calls (one per instance). Acceptable at
our scale; a distributed lock costs more than the dedup saves.

### TTL table

Single source of truth in `util/ttl.ts`, mirroring `01-architecture.md`:

```ts
// util/ttl.ts
export const TTL = {
  teams: 24 * 60 * 60,           // 24 h
  stadiums: 24 * 60 * 60,        // 24 h
  groups: 24 * 60 * 60,          // synthesized; matches teams TTL
  standings: 10 * 60,            // 10 min during matchdays
  matchesList: 60,               // 60 s — scheduler refreshes
  matchById_finished: 24 * 60 * 60,
  matchById_scheduled: 5 * 60,
  matchById_live: 30,
  lineups: 60 * 60,              // 1 h once announced; immutable after kickoff
  events_live: 30,
  events_finished: 24 * 60 * 60,
  teamStats: 5 * 60,
  matchDetails_live: 30,
  matchDetails_finished: 24 * 60 * 60,
} as const;
```

Resolve match-related TTLs at call time via `ttlForMatch(status)`:

```ts
export function ttlForMatch(status: MatchStatus): number {
  if (status === 'LIVE') return TTL.matchById_live;
  if (status === 'FINISHED') return TTL.matchById_finished;
  return TTL.matchById_scheduled;
}
```

### Firestore native TTL

Add a `_expiresAt`-based TTL policy on `matches`, `matchDetails`, `lineups`,
`standings`, `teams`, `stadiums` collections so docs eventually evict on
their own when traffic stops. The scheduler re-creates anything we still
need. Configured via `firebase firestore:ttl create _expiresAt
--collection-group=matches` etc.; document in `05-secrets-ops.md`.

---

## 6. Handlers

All callables are `https.onCall` with `enforceAppCheck: true`. CORS is
handled automatically by the callable SDK. Plain `onRequest` is used only
for `health`.

The decorator chain for every handler:

```ts
// handlers/teams.ts (example skeleton — repeats for each)
export const getTeams = onCall(
  { ...LIGHT_READ, secrets: [BALLDONTLIE_API_KEY] },
  withLogging('getTeams',
    withValidate(getTeamsInput,
      withRateLimit(
        getTeamsHandler,
      ),
    ),
  ),
);
```

Output envelope (every handler):

```ts
type Response<T> = {
  data: T;
  cached: boolean;
  stale: boolean;
  tier_required?: true;
  request_id: string;
};
```

`tier_required` is set only when upstream returned 402/403. The client uses
it to render a "your tier doesn't include this" empty state instead of
generic "no data".

### 6.1 `getTeams`

| Field | Value |
|---|---|
| Trigger | `https.onCall` |
| Inputs | `{ season: 2018 \| 2022 \| 2026 }` (default 2026 if omitted) |
| Output | `Response<Team[]>` (see `02-data-contracts.md § Team`) |
| Cache key | `teams/{season}` |
| TTL | `TTL.teams` (24 h) |
| Upstream | `GET /teams?seasons[]={season}` (paginated, expect 1 page) |
| Mapper | `mapTeam` |
| Failure | 4xx → throw `internal`; 5xx → stale-or-throw |

```ts
// handlers/teams.ts
async function getTeamsHandler(req: CallableRequest<GetTeamsInput>): Promise<Response<Team[]>> {
  const season = req.data.season ?? 2026;
  const { value, cacheHit, stale } = await cache.getOrSet(
    'teams', String(season), TTL.teams,
    async () => {
      const rows = await upstream.paginate<FIFATeam>('/teams', { 'seasons[]': [season] });
      return rows.map(mapTeam);
    },
  );
  return {
    data: stripInternal(value),
    cached: cacheHit,
    stale,
    request_id: req.rawRequest.headers['x-request-id'] as string,
  };
}
```

`/teams` is on the free tier so `TierRequiredError` should not occur. If it
does, treat as bug, not soft-empty.

### 6.2 `getStadiums`

| Field | Value |
|---|---|
| Inputs | `{ season }` |
| Output | `Response<Stadium[]>` |
| Cache key | `stadiums/{season}` |
| TTL | `TTL.stadiums` (24 h) |
| Upstream | `GET /stadiums?seasons[]={season}` |
| Mapper | `mapStadium` |

Same skeleton as `getTeams`. Used by `getVenues()` on the client (alias —
see `04-frontend-swap.md`).

### 6.3 `getGroups` (synthesized)

There is **no `/groups` endpoint** on the FIFA API. Groups are derived.

| Field | Value |
|---|---|
| Inputs | `{ season }` |
| Output | `Response<Group[]>` where `Group = { id: 'A', name: 'Group A', teams: TeamRef[] }` |
| Cache key | `groups/{season}` |
| TTL | `TTL.groups` (24 h) |
| Upstream | `GET /teams` then `GET /group_standings` (the latter may 402 on free tier; degrade) |
| Mapper | `synthesizeGroups(teams, standings)` |

**Source of group_letter:** The FIFA API surfaces group as a nested
`{id, name}` on `FIFAMatch.group` and `FIFAStanding.group`. `FIFATeam` itself
does **not** carry group. So the synthesis path is:

1. Fetch `/group_standings?seasons[]={season}`. If 200, group each standing
   row by `standing.group.name` (e.g. "A"), collect `standing.team.id`.
2. If 402/403, fall back to `/matches?seasons[]={season}` (will 402 too on
   non-GOAT — see § Tier handling) and group by `match.group.name` taking
   the union of `home_team.id` + `away_team.id`.
3. If both fail, return `{ data: [], tier_required: true }`.

```ts
// handlers/groups.ts
async function getGroupsHandler(req): Promise<Response<Group[]>> {
  const season = req.data.season ?? 2026;
  const { value, cacheHit, stale } = await cache.getOrSet(
    'groups', String(season), TTL.groups,
    async () => {
      const teams = await upstream.paginate<FIFATeam>('/teams', { 'seasons[]': [season] });
      try {
        const standings = await upstream.paginate<FIFAStanding>(
          '/group_standings', { 'seasons[]': [season] },
        );
        return synthesizeGroupsFromStandings(teams, standings);
      } catch (err) {
        if (err instanceof TierRequiredError) {
          // fall back to /matches; if that also tier-gates, throw a
          // sentinel the outer layer turns into tier_required: true
          const matches = await upstream.paginate<FIFAMatch>(
            '/matches', { 'seasons[]': [season] },
          );
          return synthesizeGroupsFromMatches(teams, matches);
        }
        throw err;
      }
    },
  );
  return {
    data: stripInternal(value),
    cached: cacheHit, stale,
    request_id: rid(req),
  };
}
```

`synthesizeGroupsFromStandings` and `synthesizeGroupsFromMatches` live in
`mappers/group.ts`. Both produce the same `Group[]` shape; tests pin both
paths against fixtures.

### 6.4 `getMatches`

| Field | Value |
|---|---|
| Inputs | `{ season?: number; status?: 'SCHEDULED'\|'LIVE'\|'FINISHED'; group?: string; date?: string (YYYY-MM-DD) }` |
| Output | `Response<Match[]>` |
| Cache key | `matches/list_{season}_{status \|\| 'all'}_{group \|\| 'all'}_{date \|\| 'all'}` |
| TTL | `TTL.matchesList` (60 s) — scheduler keeps it warm |
| Upstream | `GET /matches?seasons[]={season}` paginated; filter client-side in the mapper |
| Mapper | `mapMatch` per row; then filter |
| Failure | TierRequiredError → `{ data: [], tier_required: true }` |

Why filter server-side after fetching all? Because the upstream `/matches`
already returns the whole tournament (~64 rows) in one page at
`per_page=100`. Caching one "all" payload and slicing it per filter on the
server is cheaper than separate cache entries per filter combination.

Refinement: we cache the unfiltered list at `matches/list_{season}_all_all_all`
and every filtered call reads that doc, slices, and returns. The cache key
above can be reduced to one document per season for `getMatches`.

```ts
async function getMatchesHandler(req): Promise<Response<Match[]>> {
  const { season = 2026, status, group, date } = req.data;
  const all = await cache.getOrSet(
    'matches', `list_${season}`, TTL.matchesList,
    async () => {
      try {
        const rows = await upstream.paginate<FIFAMatch>(
          '/matches', { 'seasons[]': [season] },
        );
        return rows.map(mapMatch);
      } catch (err) {
        if (err instanceof TierRequiredError) return { _tierRequired: true, items: [] };
        throw err;
      }
    },
  );
  if (isTierGated(all.value)) return tierEmpty<Match[]>(req);
  const filtered = filterMatches(all.value as Match[], { status, group, date });
  // also write through canonical per-match docs so getMatchById is warm
  await Promise.all((all.value as Match[]).map(m =>
    cache.writeThrough('matches', m.id, ttlForMatch(m.status), m)
  ));
  return {
    data: filtered, cached: all.cacheHit, stale: all.stale,
    request_id: rid(req),
  };
}
```

The fan-out write through `matches/{matchId}` is what lets `getMatchById`
serve from cache with near-zero upstream traffic.

### 6.5 `getMatchById`

| Field | Value |
|---|---|
| Inputs | `{ id: string }` |
| Output | `Response<Match>` |
| Cache key | `matches/{id}` |
| TTL | `ttlForMatch(status)` |
| Upstream | `GET /matches?match_ids[]={id}` |
| Mapper | `mapMatch` |
| Failure | 404 from upstream → throw `not-found`; tier → tier_required |

```ts
async function getMatchByIdHandler(req): Promise<Response<Match>> {
  const id = req.data.id;
  const fresh = async () => {
    try {
      const page = await upstream.request<{ data: FIFAMatch[] }>(
        '/matches', { 'match_ids[]': [id] },
      );
      const row = page.data[0];
      if (!row) throw new HttpsError('not-found', `match ${id}`);
      return mapMatch(row);
    } catch (err) {
      if (err instanceof TierRequiredError) return { _tierRequired: true } as never;
      throw err;
    }
  };
  // We can't pick the TTL until we have the status. Use SCHEDULED TTL as floor,
  // then upgrade with a writeThrough after we know.
  const { value, cacheHit, stale } = await cache.getOrSet(
    'matches', id, TTL.matchById_scheduled, fresh,
  );
  if (isTierGated(value)) return tierEmpty(req);
  // upgrade TTL if needed
  await cache.writeThrough('matches', id, ttlForMatch(value.status), value);
  return { data: value, cached: cacheHit, stale, request_id: rid(req) };
}
```

### 6.6 `getStandings`

| Field | Value |
|---|---|
| Inputs | `{ groupId?: string; season?: number }` (null groupId → return all groups) |
| Output | `Response<Standing[]>` |
| Cache key | `standings/{season}_{groupId \|\| 'all'}` |
| TTL | `TTL.standings` (10 min) |
| Upstream | `GET /group_standings?seasons[]={season}` |
| Mapper | `mapStanding` |
| Failure | TierRequiredError → tier_required: true; this is **ALL-STAR** gated upstream |

```ts
async function getStandingsHandler(req): Promise<Response<Standing[]>> {
  const { groupId, season = 2026 } = req.data;
  const key = `${season}_${groupId ?? 'all'}`;
  const result = await cache.getOrSet(
    'standings', key, TTL.standings,
    async () => {
      try {
        const rows = await upstream.paginate<FIFAStanding>(
          '/group_standings', { 'seasons[]': [season] },
        );
        const mapped = rows.map(mapStanding);
        return groupId ? mapped.filter(s => s.groupId === groupId) : mapped;
      } catch (err) {
        if (err instanceof TierRequiredError) return { _tierRequired: true, items: [] };
        throw err;
      }
    },
  );
  if (isTierGated(result.value)) return tierEmpty(req);
  return { data: result.value, cached: result.cacheHit, stale: result.stale,
           request_id: rid(req) };
}
```

### 6.7 `getLineups`

| Field | Value |
|---|---|
| Inputs | `{ teamCode?: string; matchId: string }` |
| Output | `Response<Lineup>` (single side if `teamCode` supplied, both otherwise) |
| Cache key | `lineups/{matchId}` |
| TTL | `TTL.lineups` (1 h once announced; immutable after kickoff) |
| Upstream | `GET /match_lineups?match_ids[]={matchId}` |
| Mapper | `mapLineup` |
| Failure | TierRequiredError → tier_required; otherwise empty array if not yet announced |

```ts
async function getLineupsHandler(req): Promise<Response<Lineup | { home: Lineup; away: Lineup }>> {
  const { matchId, teamCode } = req.data;
  const result = await cache.getOrSet(
    'lineups', matchId, TTL.lineups,
    async () => {
      try {
        const rows = await upstream.paginate<FIFAMatchLineup>(
          '/match_lineups', { 'match_ids[]': [matchId] },
        );
        return mapLineup(rows);  // returns { home, away } shape
      } catch (err) {
        if (err instanceof TierRequiredError) return { _tierRequired: true } as never;
        throw err;
      }
    },
  );
  if (isTierGated(result.value)) return tierEmpty(req);
  const picked = teamCode
    ? pickSide(result.value as { home: Lineup; away: Lineup }, teamCode)
    : result.value;
  return { data: picked, cached: result.cacheHit, stale: result.stale,
           request_id: rid(req) };
}
```

`pickSide` resolves `teamCode` (e.g. "BRA") against `home.team.country_code`
and `away.team.country_code`, returns the matching side or throws
`not-found`.

---

## 7. Composite handler: `getMatchDetails`

The only server-side fan-out. The page that consumes this is the
match-detail view; one round-trip in, full payload out.

| Field | Value |
|---|---|
| Inputs | `{ matchId: string }` |
| Output | `Response<MatchDetails>` where `MatchDetails = { match, lineups, events, stats, _composedAt }` |
| Cache key | `matchDetails/{matchId}` |
| TTL | `TTL.matchDetails_live` (30 s) if match LIVE; `TTL.matchDetails_finished` (24 h) otherwise |
| Upstream | `/matches` (single) + `/match_lineups` + `/match_events` + `/team_match_stats` |
| Mapper | `mapLineup`, `mapEvent`, `mapTeamStats` |
| Failure | Per-subfield tier-required degradation |

### Flow

1. Read canonical `matches/{matchId}` doc to learn `status, home, away`. If
   missing, fetch it (delegate to `getMatchByIdHandler`'s inner fresh
   function, not the callable — share the helper).
2. Fan out **in parallel**:
   - `getOrSet('lineups', matchId, TTL.lineups, fetchLineups)`
   - `getOrSet('events', matchId, eventsTtl(status), fetchEvents)`
   - `getOrSet('teamStats', matchId, TTL.teamStats, fetchTeamStats)`
3. Each `fetch*` catches `TierRequiredError` internally and returns
   `{ _tierRequired: true }`.
4. Compose:
   ```ts
   const details = {
     match,
     lineups: tier(lineups) ? null : lineups,
     events: tier(events) ? [] : events,
     stats: tier(stats) ? null : stats,
     _composedAt: Timestamp.now(),
     tier_required:
       tier(lineups) || tier(events) || tier(stats) ? true : undefined,
   };
   ```
5. Write through `matchDetails/{matchId}` with TTL chosen on `match.status`.
6. Return.

```ts
// handlers/matchDetails.ts (skeleton)
async function getMatchDetailsHandler(req): Promise<Response<MatchDetails>> {
  const { matchId } = req.data;
  const match = await getOrFetchMatch(matchId);  // shared helper
  const ttl = match.status === 'LIVE'
    ? TTL.matchDetails_live : TTL.matchDetails_finished;

  const { value, cacheHit, stale } = await cache.getOrSet(
    'matchDetails', matchId, ttl,
    async () => {
      const [lineups, events, stats] = await Promise.all([
        fetchLineupsSafe(matchId),
        fetchEventsSafe(matchId, match.status),
        fetchTeamStatsSafe(matchId),
      ]);
      return composeDetails(match, lineups, events, stats);
    },
  );
  return { data: stripInternal(value), cached: cacheHit, stale, request_id: rid(req) };
}
```

`fetchLineupsSafe` / `fetchEventsSafe` / `fetchTeamStatsSafe` each go
through their own `cache.getOrSet` (so a repeated `getMatchDetails` call
won't refetch lineups if they're still warm). The outer
`matchDetails/{matchId}` doc is a **memoized composition**; the inner docs
are the canonical caches.

Per-subfield TTLs matter: a finished match's events never change, so they
stay cached for 24 h even if the composite doc evicts.

---

## 8. Schedulers

All schedulers are `onSchedule` (Pub/Sub-backed Cloud Scheduler). Time zone:
`UTC` for everything; matchday detection uses kickoff `datetime` already in
UTC from upstream.

### 8.1 `refreshLiveMatches`

| Field | Value |
|---|---|
| Schedule | `every 30 seconds` (and we self-throttle to every 5 min when nothing is LIVE) |
| Reads | `matches/list_{currentSeason}` to find LIVE matches |
| Writes | `matches/{id}`, `matchDetails/{id}`, `events/{id}`, `teamStats/{id}` |
| Idempotency | Overwrites by doc id with `set()`; no append-only state |

```ts
export const refreshLiveMatches = onSchedule(
  { schedule: 'every 30 seconds', timeZone: 'UTC',
    secrets: [BALLDONTLIE_API_KEY], ...SCHEDULER },
  async () => {
    const state = await readSchedulerState();  // meta/scheduler_state
    if (state.next_run_at && Date.now() < state.next_run_at.toMillis()) return;

    const season = state.currentSeason ?? 2026;
    const list = await fetchMatchesListFresh(season);  // bypasses cache
    const live = list.filter(m => m.status === 'LIVE');

    if (live.length === 0) {
      await writeSchedulerState({
        currentSeason: season, mode: 'idle',
        next_run_at: Timestamp.fromMillis(Date.now() + 5 * 60_000),
        liveMatchCount: 0,
      });
      // still write through the list so the client sees the latest schedule
      await cache.writeThrough('matches', `list_${season}`, TTL.matchesList, list);
      return;
    }

    await cache.writeThrough('matches', `list_${season}`, 30, list);
    await Promise.all(live.map(refreshOneLiveMatch));

    await writeSchedulerState({
      currentSeason: season, mode: 'live',
      next_run_at: Timestamp.fromMillis(Date.now() + 30_000),
      liveMatchCount: live.length,
    });
  },
);
```

`refreshOneLiveMatch(match)` writes `matches/{id}` and re-fans the same
three subfields as `getMatchDetails`. It does **not** write
`matchDetails/{id}` directly; the client reads each subfield doc
independently via Firestore listeners during a live match (see
`04-frontend-swap.md`).

Partial failure: each `refreshOneLiveMatch` is wrapped in its own try/catch
and logs `{ scheduler: 'refreshLiveMatches', matchId, err }`. One bad match
doesn't abort the batch. We still update `scheduler_state.next_run_at` so
the next tick fires on schedule.

### 8.2 `refreshFixtures`

| Field | Value |
|---|---|
| Schedule | `0 4 * * *` (04:00 UTC daily) |
| Reads | nothing |
| Writes | `matches/list_{season}`, fan-out `matches/{id}` |
| Idempotency | full overwrite of `matches/list_{season}` |

```ts
export const refreshFixtures = onSchedule(
  { schedule: '0 4 * * *', timeZone: 'UTC',
    secrets: [BALLDONTLIE_API_KEY], ...SCHEDULER },
  async () => {
    for (const season of [2018, 2022, 2026]) {
      try {
        const rows = await upstream.paginate<FIFAMatch>(
          '/matches', { 'seasons[]': [season] },
        );
        const mapped = rows.map(mapMatch);
        await cache.writeThrough('matches', `list_${season}`,
          TTL.matchesList, mapped);
        await Promise.all(mapped.map(m =>
          cache.writeThrough('matches', m.id, ttlForMatch(m.status), m)
        ));
      } catch (err) {
        logger.error('refreshFixtures.failed', { season, err: String(err) });
      }
    }
  },
);
```

The 2018 + 2022 seasons fan out so `?season=2022` is also cache-warm. Skip
them if cost becomes an issue.

### 8.3 `refreshStandings`

| Field | Value |
|---|---|
| Schedule | `*/10 * * * *` (every 10 min), self-skip on off-days |
| Reads | `matches/list_{season}` to decide if it's a matchday |
| Writes | `standings/{season}_all` and per-group docs |
| Idempotency | overwrite by doc id |

```ts
export const refreshStandings = onSchedule(
  { schedule: '*/10 * * * *', timeZone: 'UTC',
    secrets: [BALLDONTLIE_API_KEY], ...SCHEDULER },
  async () => {
    const season = 2026;
    if (!(await isMatchdayToday(season))) {
      logger.info('refreshStandings.skipped', { reason: 'no_matches_today' });
      return;
    }
    try {
      const rows = await upstream.paginate<FIFAStanding>(
        '/group_standings', { 'seasons[]': [season] },
      );
      const mapped = rows.map(mapStanding);
      await cache.writeThrough('standings', `${season}_all`, TTL.standings, mapped);
      const byGroup = groupBy(mapped, s => s.groupId);
      await Promise.all(Object.entries(byGroup).map(([gid, rows]) =>
        cache.writeThrough('standings', `${season}_${gid}`, TTL.standings, rows)
      ));
    } catch (err) {
      if (err instanceof TierRequiredError) {
        logger.warn('refreshStandings.tier_required'); return;
      }
      logger.error('refreshStandings.failed', { err: String(err) });
    }
  },
);
```

`isMatchdayToday` reads the cached fixtures list and returns true if any
match's `datetime` is within today UTC (or within the next 4 h, to cover
pre-match window).

---

## 9. Rate limiting

Per-anonymous-Auth-UID token bucket, enforced inside `withRateLimit`:

- Capacity: 60 tokens.
- Refill: 1 token/sec.
- Bucket doc: `meta/rate_buckets/{uid}` with `{ tokens, last_refill_at }`.

```ts
// middleware/rateLimit.ts
export function withRateLimit<T, R>(
  handler: (req: CallableRequest<T>) => Promise<R>,
) {
  return async (req: CallableRequest<T>): Promise<R> => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'auth required');
    const ref = db.doc(`meta/rate_buckets/${uid}`);
    await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      const now = Date.now();
      const prev = snap.exists ? snap.data()! : { tokens: 60, last_refill_at: now };
      const elapsed = (now - prev.last_refill_at) / 1000;
      const tokens = Math.min(60, prev.tokens + elapsed);
      if (tokens < 1) throw new HttpsError('resource-exhausted', 'rate limited');
      tx.set(ref, { tokens: tokens - 1, last_refill_at: now });
    });
    return handler(req);
  };
}
```

One Firestore write per request is real cost. At the GOAT-tier scale we
expect (<10k requests/day in steady state, <100k on a high-traffic match
day) this is <$0.20/day at current Firestore pricing. Cross-ref the cost
section in `01-architecture.md`.

The server-internal upstream budget (separate from per-user limits) is
tracked in `meta/upstream_budget` and incremented by `upstream/client.ts`
on every successful 200 response. The doc carries
`{ date: 'YYYY-MM-DD', count }`; we reset on date change. A daily check in
the scheduler logs a warning at 80% of the GOAT-tier monthly cap divided
into days.

---

## 10. Observability

### Logs

Single structured exit log per handler, via `firebase-functions/logger`:

```ts
logger.info('handler.complete', {
  handler: 'getMatches',
  cache_hit: true,
  stale: false,
  upstream_ms: 0,
  total_ms: 14,
  status: 'ok',
  season: 2026,
  key: 'matches/list_2026',
  request_id: 'req_abc123',
  uid: 'anon_xyz',
});
```

Errors log under `handler.error` with the same shape plus `err_class,
err_message, err_path`.

### Counters → Cloud Monitoring

Three log-based metrics, defined in `05-secrets-ops.md`:

- `cache_hit_ratio` — fraction of `handler.complete` with `cache_hit: true`,
  filtered by handler.
- `tier_required_responses` — count of responses with `tier_required: true`.
  Alert: >0 in prod is a tier-config issue.
- `upstream_5xx_rate` — count of `upstream.error` entries with `status >=
  500`. Alert: >5/min sustained for 5 min.

### Trace IDs

The client sends `x-request-id` on every callable. Server reads from
`req.rawRequest.headers['x-request-id']`; mints `req_${nanoid(12)}` if
missing. Threaded into every log line.

```ts
// util/requestId.ts
export function rid(req: CallableRequest): string {
  const h = req.rawRequest.headers['x-request-id'];
  if (typeof h === 'string' && h.length > 0) return h;
  return `req_${nanoid(12)}`;
}
```

### Health endpoint

`handlers/health.ts`:

```ts
export const health = onRequest(
  { region: 'us-central1', cors: true, invoker: 'public' },
  async (req, res) => {
    res.json({ status: 'ok', ts: new Date().toISOString() });
  },
);
```

No App Check, no rate limit. Used by external uptime monitoring.

---

## 11. Testing

### Mappers

Pure functions, pure tests. Each `mappers/*.ts` has a `mappers/*.test.ts`
that loads a captured fixture from `test/fixtures/upstream/*.json` and
asserts the output matches a frozen snapshot of the internal shape from
`02-data-contracts.md`.

```ts
// test/mappers/match.test.ts
import fixture from '../fixtures/upstream/matches_2022.json';
import { mapMatch } from '../../src/mappers/match';

test('mapMatch 2022 final', () => {
  const out = mapMatch(fixture.data[63]);  // the final
  expect(out).toEqual({
    id: '<id>', season: 2022, status: 'FINISHED',
    home: { code: 'ARG', name: 'Argentina', ... },
    away: { code: 'FRA', name: 'France', ... },
    score: { home: 3, away: 3, et: { home: 3, away: 3 }, pens: { home: 4, away: 2 } },
    // ...
  });
});
```

### Handlers

Integration tests under the Firebase emulators (Firestore + Functions). The
upstream client is stubbed at module level by `test/helpers/stubUpstream.ts`,
which replaces `upstream/client.ts`'s `request` and `paginate` with fixture
replay.

```ts
// test/handlers/matches.test.ts
import { stubUpstream } from '../helpers/stubUpstream';
stubUpstream({
  '/matches?seasons[]=2022': () => fixtureFor('matches_2022.json'),
});
const wrapped = httpsCallableFromURL(emulatorUrl('getMatches'));
const res = await wrapped({ season: 2022 });
expect(res.data.data).toHaveLength(64);
expect(res.data.cached).toBe(false);
const res2 = await wrapped({ season: 2022 });
expect(res2.data.cached).toBe(true);  // second call hits Firestore
```

### Record fixtures

```sh
npm run record-fixtures -- /teams 'seasons[]=2022'
```

Hits the real API with `BALLDONTLIE_API_KEY` from `.env.local`, strips the
`Authorization` header from any captured request log, writes
`test/fixtures/upstream/<slug>.json`. Manual; not in CI.

---

## 12. Local dev workflow

```sh
# from repo root
cd functions && npm install
cd .. && firebase emulators:start --only functions,firestore,auth
```

`.env.local` (in `functions/`, gitignored):

```
BALLDONTLIE_API_KEY=<dev_key>
FIREBASE_PROJECT=worldcup-pwa-dev
```

The upstream client reads `BALLDONTLIE_API_KEY.value()` in prod and
`process.env.BALLDONTLIE_API_KEY` in the emulator (`value()` returns empty
when no secret is bound). Document this in `05-secrets-ops.md`.

### Seed script

```sh
npm run seed
```

`scripts/seed.ts` loops over `test/fixtures/upstream/*.json`, runs each
through the matching mapper, writes to the emulator's Firestore at the same
collection/doc id the real handlers would. With seed data in place, the UI
renders without ever calling upstream — useful for design review and for
offline development.

---

## 13. Deployment

```sh
# everything
firebase deploy

# functions only
firebase deploy --only functions

# one function (e.g. after a hotfix)
firebase deploy --only functions:getMatches

# hosting only
firebase deploy --only hosting
```

`functions/package.json` has:

```json
{
  "scripts": {
    "lint": "eslint --max-warnings 0 src/",
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "predeploy": "npm run lint && npm run build && npm run test"
  },
  "engines": { "node": "20" }
}
```

`firebase.json` adds:

```json
{
  "functions": [{
    "source": "functions",
    "codebase": "default",
    "runtime": "nodejs20",
    "predeploy": ["npm --prefix \"$RESOURCE_DIR\" run predeploy"]
  }]
}
```

Version pinning: commit `package-lock.json`. CI runs `npm ci`, not `npm
install`.

Shared types: the client imports `Response<T>`, `Match`, `Team`, etc. from
`@worldcup/types`. Options:
1. A local workspace package (`packages/types/`) — preferred if we
   already have or are willing to add a monorepo layout.
2. Ship `schemas/outputs.d.ts` as part of the functions build and have the
   client import it via a relative path.

Option 1 is cleaner; pick during implementation. **TBD verify** against
current `package.json` layout.

---

## 14. Security

### App Check

Every callable: `enforceAppCheck: true, consumeAppCheckToken: true`. The
callable SDK rejects unsigned requests before the handler runs. In the
emulator, App Check is disabled by default; explicit
`firebase functions:shell` calls still work.

Web client uses reCAPTCHA Enterprise; setup in `05-secrets-ops.md`.

### Input validation

Every handler entry runs `zod.parse()`:

```ts
// schemas/inputs.ts
import { z } from 'zod';

export const getMatchesInput = z.object({
  season: z.number().int().refine(v => [2018, 2022, 2026].includes(v)).optional(),
  status: z.enum(['SCHEDULED', 'LIVE', 'FINISHED']).optional(),
  group: z.string().regex(/^[A-H]$/).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export type GetMatchesInput = z.infer<typeof getMatchesInput>;
```

On failure: `HttpsError('invalid-argument', issues)`.

### Output sanitization

Every Firestore-cached doc has internal fields (`_fetchedAt, _expiresAt,
_schema, _source`). `util/sanitize.ts` strips any key starting with `_`
before the response leaves the function. Apply in the response envelope
construction, not at write time — Firestore retains the metadata.

```ts
export function stripInternal<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripInternal) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k.startsWith('_')) continue;
      out[k] = stripInternal(v);
    }
    return out as T;
  }
  return value;
}
```

### Firestore security rules

Document in `05-secrets-ops.md`, but the contract is:

- `teams/*, stadiums/*, matches/*, matchDetails/*, lineups/*, standings/*`
  — public read; no client write.
- `meta/*` — no client read or write.
- All writes from the server (admin SDK bypasses rules).

---

## 15. Cross-references

- `01-architecture.md § 4 Cache keys`, `§ 5 TTL table`, `§ 7 Error budgets`.
- `02-data-contracts.md § Internal shape v2` (mapper outputs).
- `04-frontend-swap.md § Client signatures` (how the PWA calls these).
- `05-secrets-ops.md § Secret Manager`, `§ App Check`, `§ Deploy`, `§
  Firestore rules`, `§ Cloud Monitoring`.

---

## 16. Implementation checklist

Numbered list, one acceptance criterion per file. Feeds `06-progress.md`.

1. **`functions/package.json`** — `engines.node=20`, deps:
   `firebase-functions@^5, firebase-admin@^12, zod, nanoid`; dev deps:
   `typescript, vitest, eslint, @types/node`. Scripts: `lint, build,
   test, predeploy`. `npm run build` exits 0 on an empty `src/`.
2. **`functions/tsconfig.json`** — `target: ES2022, module: NodeNext,
   strict: true, outDir: lib`. `tsc --noEmit` exits 0.
3. **`functions/.eslintrc.json`** — extends recommended + TS rules. `npm run
   lint` exits 0 on stub files.
4. **`src/config.ts`** — exports `BALLDONTLIE_API_KEY,
   HEAVY_READ/LIGHT_READ/COMPOSITE/SCHEDULER, BASE_URL`. Calls
   `setGlobalOptions({ region: 'us-central1' })`. Unit test asserts shape.
5. **`src/upstream/types.ts`** — `FIFATeam, FIFAStadium, FIFAMatch,
   FIFAMatchLineup, FIFAMatchEvent, FIFATeamMatchStats, FIFAStanding,
   FIFAGroup` interfaces. Compiles.
6. **`src/upstream/errors.ts`** — `UpstreamError` base + 6 subclasses
   listed in § 4. Each exports `instanceof` checks.
7. **`src/upstream/client.ts`** — `request<T>`, `paginate<T>` per § 4.
   Stubbed-fetch unit tests cover: 200 happy path, 401, 402, 429
   retry-after, 500 single retry, timeout, pagination 3-page walk, 10-page
   cap.
8. **`src/cache/keys.ts`** — pure builders. `teamsKey, stadiumsKey,
   groupsKey, matchesListKey, matchKey, matchDetailsKey, lineupsKey,
   standingsKey, eventsKey, teamStatsKey`. Unit tests pin output strings.
9. **`src/cache/mutex.ts`** — `run<T>(key, fn)`. Test: 100 concurrent
   `run('k', slowFn)` invokes `slowFn` once.
10. **`src/cache/firestore.ts`** — `getOrSet<T>, writeThrough<T>,
    readFresh<T>`. Emulator-backed tests cover hit, miss, stale-fallback
    on freshFn error, stampede coalesced.
11. **`src/util/ttl.ts`** — `TTL` const + `ttlForMatch`. Unit tests pin
    table values.
12. **`src/util/time.ts`** — `now, parseISO, isMatchdayToday`. Unit tests.
13. **`src/util/requestId.ts`** — `rid(req)`. Test: header present →
    returned; absent → `req_*` minted.
14. **`src/util/sanitize.ts`** — `stripInternal`. Tests: nested, arrays,
    non-objects pass through.
15. **`src/mappers/team.ts`** — `mapTeam(FIFATeam): Team`. Fixture test.
16. **`src/mappers/stadium.ts`** — `mapStadium`. Fixture test.
17. **`src/mappers/match.ts`** — `mapMatch`. Fixture tests for SCHEDULED,
    LIVE, FINISHED, finished-after-pens.
18. **`src/mappers/lineup.ts`** — `mapLineup(rows: FIFAMatchLineup[]):
    { home, away }`. Fixture test.
19. **`src/mappers/event.ts`** — `mapEvent(FIFAMatchEvent): Event`. Fixture
    test covering GOAL, CARD, SUB, PEN, OG.
20. **`src/mappers/team-stats.ts`** — `mapTeamStats`. Fixture test.
21. **`src/mappers/standings.ts`** — `mapStanding`. Fixture test.
22. **`src/mappers/group.ts`** — `synthesizeGroupsFromStandings`,
    `synthesizeGroupsFromMatches`. Tests against both fixtures.
23. **`src/schemas/inputs.ts`** — zod schema per callable. Tests on
    success + failure cases.
24. **`src/schemas/outputs.ts`** — response TS interfaces; compiled
    `.d.ts` shipped to client.
25. **`src/middleware/appCheck.ts`** — `withAppCheck` helper or
    `CallableOptions` snippet. Emulator test confirms rejection on missing
    token.
26. **`src/middleware/rateLimit.ts`** — `withRateLimit`. Tests: 60 succeed,
    61st throws `resource-exhausted`; refill after 1 s.
27. **`src/middleware/logging.ts`** — `withLogging`. Test asserts one
    `handler.complete` per call with required fields.
28. **`src/middleware/validate.ts`** — `withValidate`. Test: valid input
    passes; invalid → `invalid-argument`.
29. **`src/handlers/teams.ts`** — `getTeams` callable. Integration test
    against stubbed upstream + emulator Firestore: miss writes through,
    hit returns cached.
30. **`src/handlers/stadiums.ts`** — `getStadiums`. Same.
31. **`src/handlers/groups.ts`** — `getGroups`. Tests for both synthesis
    paths and the tier-gated fallback.
32. **`src/handlers/matches.ts`** — `getMatches, getMatchById`. Tests:
    list → fans out per-match docs; filter combinations slice from one
    cached doc.
33. **`src/handlers/matchDetails.ts`** — `getMatchDetails`. Tests:
    fan-out parallelism (assert <3× single fetch latency), per-subfield
    tier degradation, scheduler-warmed path returns cached.
34. **`src/handlers/lineups.ts`** — `getLineups`. Tests: both sides,
    one side by teamCode, unknown teamCode → not-found.
35. **`src/handlers/standings.ts`** — `getStandings`. Tests: all groups,
    single group, tier-gated soft empty.
36. **`src/handlers/health.ts`** — `health` onRequest. Returns 200 JSON.
37. **`src/schedulers/refreshLiveMatches.ts`** — onSchedule, self-throttling
    state in `meta/scheduler_state`. Emulator test (manual trigger): live
    fixture writes through `matches/*` + subfield docs; idle fixture sets
    `next_run_at` 5 min out.
38. **`src/schedulers/refreshFixtures.ts`** — onSchedule daily.
    Emulator test: writes `matches/list_{season}` and N per-match docs.
39. **`src/schedulers/refreshStandings.ts`** — onSchedule every 10 min,
    self-skips off-days. Emulator test: matchday fixture writes; non-matchday
    skips.
40. **`src/index.ts`** — re-exports every callable + scheduler.
    `firebase deploy --only functions --dry-run` lists each one.
41. **`test/helpers/stubUpstream.ts`** — fixture replay. Used by every
    handler test.
42. **`test/helpers/emulator.ts`** — bootstrap. Used by every emulator
    test.
43. **`scripts/record-fixtures.ts`** — CLI: `tsx scripts/record-fixtures.ts
    <path> <query>`. Writes a redacted JSON to `test/fixtures/upstream/`.
44. **`scripts/seed.ts`** — populates emulator Firestore. `npm run seed`
    finishes with a count log.
45. **`firebase.json`** — adds `functions` entry with predeploy hook.
46. **TTL policies** — `gcloud firestore fields ttls update _expiresAt
    --collection-group=matches` (and matchDetails, lineups, standings,
    teams, stadiums). Documented in `05-secrets-ops.md`. Acceptance: `gcloud
    firestore fields ttls list` shows all six.
47. **Log-based metrics** — `cache_hit_ratio, tier_required_responses,
    upstream_5xx_rate`. Created via `gcloud logging metrics create`.
    Documented in `05-secrets-ops.md`.
48. **Alerts** — Cloud Monitoring alert policies for `upstream_5xx_rate >
    5/min` and `tier_required_responses > 0` (prod only). Documented in
    `05-secrets-ops.md`.

End of spec. Implementation order is the checklist order — config and
upstream client first, mappers next, then handlers, then schedulers, then
ops. Each item lands as its own PR with the acceptance criterion as the
test gate.
