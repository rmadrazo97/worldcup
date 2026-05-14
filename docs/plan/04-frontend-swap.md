# 04 — Frontend Swap: Mock-Data Removal and Live Wiring

> Status: spec — not yet implemented.
> Owner: frontend.
> Depends on: `02-data-contracts.md` (v2 shapes), `03-backend-functions.md` (callable names).
> Touches: `src/api/*`, every component under `src/components/*` and `src/pages/*` that today touches `mock-data.js`, plus `vite.config.js`.

This document specifies the refactor that takes the app from "everything imports the in-memory `mock-data.js` fixture" to "everything reads from Firebase callables, with Firestore `onSnapshot` for live matches." The seam in `src/api/scores.js` keeps its public signatures; component prop shapes are preserved where possible. Live updates arrive via direct Firestore listeners, not polling.

---

## 1. Goals

1. **Zero `import … from '../api/mock-data.js'` in production code paths.** The file moves to `src/api/fixtures/2022-final.js` and is referenced only from tests and Storybook-style demos.
2. **The `src/api/scores.js` seam keeps identical public signatures.** Every function still returns a `Promise` of the documented v2 shape. Only bodies change.
3. **Components consume v2 fields directly.** Where the v2 shape adds or renames a field (e.g. `team.code` lowercase ISO-2 for flag CDN), components are updated to read the new field rather than mutating between layers.
4. **Real-time updates for `LIVE` matches without `setInterval`.** Subscriptions to `matches/{matchId}` and `matchDetails/{matchId}` via `onSnapshot` replace any timer-driven refresh.
5. **No prop drilling of teams.** A `TeamsProvider` loads `getTeams()` once on app boot; everything that previously imported `TEAMS` calls `useTeams()`.
6. **All existing loading / error / empty states stay.** Two new states are introduced:
   - `tier_required` — "Detailed stats require a paid subscription."
   - `season_unavailable` — "Data for this season is not available."
7. **`?season=2018|2022` URL query overrides the default `2026` everywhere.** A `getActiveSeason()` helper reads it and threads it through every callable.
8. **`getNow()` flips to `() => new Date()` in production.** A frozen "mock now" survives only when `?season=2022` or `?season=2018` is in the URL — historical viewing still feels "now."

Non-goals: visual redesign, route changes, accessibility audit, i18n, dark/light theme.

---

## 2. New client modules

Spec for each new file under `src/api/`. Bodies are sketched at 10–30 lines so reviewers can see the surface area; the real implementation should not be larger.

### 2.1 `src/api/client.js` — Firebase bootstrap

Responsibilities:

- Initialize the Firebase app (web SDK v10+ modular API).
- Initialize **App Check** with reCAPTCHA Enterprise *before* any other Firebase call.
- Initialize **Auth** and trigger anonymous sign-in.
- Initialize **Firestore** and **Functions** for the configured region.
- In `dev` (`VITE_USE_EMULATORS === 'true'`), wire to the emulator suite.
- Expose a `callable(name)` helper for the rest of the app.

Exports: `app`, `auth`, `db`, `functions`, `appCheck`, `callable`, `whenReady`.

Sketch:

```js
import { initializeApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check'
import { getAuth, signInAnonymously, connectAuthEmulator } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions'

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
}

export const app = initializeApp(cfg)

// Must come before getAuth / getFirestore / getFunctions usage that triggers reads.
if (import.meta.env.DEV) {
  // eslint-disable-next-line no-restricted-globals
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = true
}

export const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaEnterpriseProvider(import.meta.env.VITE_RECAPTCHA_KEY),
  isTokenAutoRefreshEnabled: true,
})

const region = import.meta.env.VITE_FUNCTIONS_REGION || 'us-central1'
export const auth = getAuth(app)
export const db = getFirestore(app)
export const functions = getFunctions(app, region)

if (import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, 'localhost', 8080)
  connectFunctionsEmulator(functions, 'localhost', 5001)
}

export const callable = (name) => httpsCallable(functions, name)

export const whenReady = signInAnonymously(auth).then(() => true)
```

Notes:

- `whenReady` is awaited inside the `<TeamsProvider>` before the first callable fires. App Check tokens require an authenticated context.
- Callable name strings are centralized in `src/api/scores.js`; `client.js` does not know the names.
- App Check debug token: in `dev`, set `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true` *before* `initializeAppCheck`, then paste the token from devtools into the Firebase console once per developer machine. See `05-secrets-ops.md`.

### 2.2 `src/api/season.js` — active-season resolver

Responsibilities:

- Read `?season=` from `window.location.search`.
- Validate against the allow-list `[2018, 2022, 2026]`.
- Fall back to `2026`.
- Provide a `subscribeSeason(cb)` hook for a future UI selector (no consumer today; included so the API doesn't have to break later).

Sketch:

```js
const VALID = new Set([2018, 2022, 2026])

export function getActiveSeason() {
  if (typeof window === 'undefined') return 2026
  const raw = new URLSearchParams(window.location.search).get('season')
  const n = Number.parseInt(raw ?? '', 10)
  return VALID.has(n) ? n : 2026
}

export function isHistoricalSeason() {
  return getActiveSeason() !== 2026
}

const listeners = new Set()
let cached = getActiveSeason()

export function subscribeSeason(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

// Called by SeasonProvider on URL change to fan out to non-React subscribers.
export function _notifySeasonChange() {
  const next = getActiveSeason()
  if (next === cached) return
  cached = next
  for (const cb of listeners) cb(next)
}
```

Edge cases:

- `?season=2026` is a no-op (the default).
- `?season=banana` is silently coerced to `2026`. We do **not** throw — bad URLs shouldn't kill the app.
- `?season=2014` (out of allow-list) is also coerced to `2026`. The decision: data we don't host shouldn't be selectable, even if balldontlie supports it.

### 2.3 `src/api/scores.js` — rewrite (same exports)

Public surface is unchanged. Every function:

1. Reads `season = getActiveSeason()` (no parameter — URL is the source of truth).
2. Calls `callable('functionName')({ season, ...args })`.
3. Maps `result.data` to the v2 shape (most mapping happens server-side; client only re-keys what's load-bearing).
4. Returns the mapped object.
5. Surfaces errors with Firebase error codes intact.

Names and call signatures:

| Export | Args | Callable name (per `03-backend-functions.md`) | Returns |
|---|---|---|---|
| `getTeams()` | — | `getTeams` | `Record<short, Team>` |
| `getStadiums()` | — | `getStadiums` | `Record<id, Stadium>` |
| `getVenues()` | — | derived from `getStadiums()` | `Record<id, Venue>` (legacy alias) |
| `getMatches({ status, group, date })` | filter | `getMatches` | `Match[]` |
| `getMatchById(id)` | id | `getMatchById` | `Match \| null` |
| `getStandings(groupId)` | groupId | `getStandings` | `Standing[]` |
| `getGroups()` | — | **client-composed** from `getTeams()` + `getStandings()` | `Group[]` |
| `getLineup(teamCode)` | teamCode | `getLineup` | `Lineup \| null` |
| `getMatchDetails(matchId)` | matchId | `getMatchDetails` | `MatchDetails \| null` |
| `getFormation(name)` | name | **pure local lookup** (not a callable) | `Formation` |

Why `getGroups` is composed client-side: balldontlie does not expose a `/groups` endpoint, and we do not want to maintain a separate Firestore collection that duplicates info already on `teams[*].group` plus `standings`. The composition is:

```js
export async function getGroups() {
  const teams = await getTeams()
  const ids = [...new Set(Object.values(teams).map((t) => t.group))].sort()
  const standings = await Promise.all(ids.map((id) => getStandings(id)))
  return ids.map((id, i) => ({
    id,
    teams: Object.values(teams).filter((t) => t.group === id).map((t) => t.short),
    standings: standings[i],
  }))
}
```

Why `getFormation` stays local: a formation is a set of `{role, x, y}` pitch coordinates ("4-3-3", "4-4-2", etc.). It's static, identical across seasons, and tiny. Round-tripping it through a callable is wasted latency. Keep `FORMATIONS` as a local constant table — but import it from `src/api/formations.js`, not `mock-data.js`.

In-memory dedup (one render tick):

```js
const inFlight = new Map() // key -> Promise

function once(key, fn) {
  if (inFlight.has(key)) return inFlight.get(key)
  const p = fn().finally(() => {
    // Clear on the next microtask so simultaneous callers share, but the
    // next render tick gets a fresh fetch.
    queueMicrotask(() => inFlight.delete(key))
  })
  inFlight.set(key, p)
  return p
}
```

Used as:

```js
export async function getTeams() {
  const season = getActiveSeason()
  return once(`teams:${season}`, async () => {
    const { data } = await callable('getTeams')({ season })
    return data.teams // already a Record<short, Team>
  })
}
```

Error mapping: callable errors arrive as `FirebaseError` with `code` like `functions/permission-denied`, `functions/resource-exhausted`, `functions/unavailable`, `functions/failed-precondition` (our `tier_required`), `functions/not-found` (our `season_unavailable`). Components compare against the `.code` string; do not re-wrap.

### 2.4 `src/api/live.js` — Firestore listeners for live matches

Responsibilities:

- `subscribeMatch(matchId, cb)` — subscribe to `matches/{matchId}`. Returns an `unsubscribe()` function.
- `subscribeMatchDetails(matchId, cb)` — subscribe to `matchDetails/{matchId}`.
- `subscribeLiveIndex(cb)` — subscribe to `meta/liveIndex` (a single tiny doc listing currently-live match IDs).
- Each subscription maps the raw Firestore document to the v2 shape via the same mappers `scores.js` uses (factor mappers into `src/api/mappers.js`).
- All three are no-ops outside the `2026` season — historical matches don't have live docs, so we short-circuit and return a `() => {}` unsubscribe.

Sketch:

```js
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from './client.js'
import { getActiveSeason } from './season.js'
import { mapMatch, mapMatchDetails, mapLiveIndex } from './mappers.js'

function noop() {}

export function subscribeMatch(matchId, cb) {
  if (getActiveSeason() !== 2026) return noop
  const ref = doc(db, 'matches', matchId)
  return onSnapshot(
    ref,
    (snap) => cb(snap.exists() ? mapMatch(snap.data()) : null),
    (err) => cb(null, err),
  )
}

export function subscribeMatchDetails(matchId, cb) {
  if (getActiveSeason() !== 2026) return noop
  const ref = doc(db, 'matchDetails', matchId)
  return onSnapshot(
    ref,
    (snap) => cb(snap.exists() ? mapMatchDetails(snap.data()) : null),
    (err) => cb(null, err),
  )
}

export function subscribeLiveIndex(cb) {
  if (getActiveSeason() !== 2026) return noop
  const ref = doc(db, 'meta', 'liveIndex')
  return onSnapshot(ref, (snap) => cb(snap.exists() ? mapLiveIndex(snap.data()) : { matchIds: [] }))
}
```

Listener discipline (enforced by reviewer checklist):

- Every effect that calls `subscribeMatch` / `subscribeMatchDetails` returns the unsubscribe from its cleanup.
- An effect that depends on `matchId` re-subscribes when the ID changes (cleanup → re-attach is automatic via React's effect rules).
- Errors are delivered via the second `cb` arg, not thrown. Components decide whether to render an error state or keep the last good snapshot.

### 2.5 `src/api/clock.js` — modify in place

Replace `MOCK_NOW` with a per-season fallback. Production (`season === 2026`) uses real `new Date()`. Historical seasons use the "final whistle" moment so the UI shows the tournament as just-completed (matches lit up, "FT" everywhere).

```js
import { getActiveSeason } from './season.js'

const FROZEN = {
  2018: new Date('2018-07-15T18:00:00Z'), // World Cup final, FRA vs CRO
  2022: new Date('2022-12-18T18:00:00Z'), // World Cup final, ARG vs FRA
}

export function getNow() {
  const season = getActiveSeason()
  return FROZEN[season] ?? new Date()
}
```

All formatter helpers (`formatShortDate`, `formatLongEyebrow`, `isSameLocalDay`, `MONTHS_*`, `DOWS_*`) are unchanged.

### 2.6 `src/api/mappers.js` — shape adapters (new)

Single file holding `mapTeam`, `mapStadium`, `mapMatch`, `mapMatchDetails`, `mapLineup`, `mapStanding`, `mapLiveIndex`. Each maps the raw Firestore / callable payload to the v2 shape declared in `02-data-contracts.md`. Mappers are pure, exported, and exercised directly by the unit tests under `src/api/__tests__/mappers.test.js`.

### 2.7 `src/api/formations.js` — extracted constant table

Move the `FORMATIONS` constant out of `mock-data.js` into its own module. Components and `scores.js#getFormation` both read from here. No data fetched — pure constants.

---

## 3. Component-by-component refactor plan

For each component below: (a) current mock-data dependency, (b) new data source, (c) prop interface or new hooks, (d) loading/empty/error states.

### 3.1 `src/pages/MainFeed.jsx`

(a) Currently imports `computeStandings, TEAMS, VENUES` from `mock-data.js`. Also imports `getMatches`, `getGroups`, etc. from `scores.js`.

(b) New data source:
- `teams` from `useTeams()`.
- `venues` from `getVenues()` (memoized at page level).
- `standings` — already comes via `getStandings`; the page no longer needs `computeStandings` because that's server-side now.

(c) Prop interface: unchanged (no props — it's a route). New internal hooks:
```js
const { teams, loading: teamsLoading, error: teamsError } = useTeams()
const [venues, setVenues] = useState({})
const [groups, setGroups] = useState([])
const [matches, setMatches] = useState([])
```
All three fetches fire in parallel inside one `useEffect` keyed on `useSeason()` so a season change in the URL re-fetches.

(d) States:
- Loading: existing skeleton screens (`.detail-fallback`). Show until `teams && groups && matches` are all non-null.
- Error: if any fetch rejects, render the page-level error banner with retry. Don't crash siblings — partial render is OK (e.g. groups loaded, live section still spinning).
- Empty: existing "No matches today" copy.
- `tier_required`: not applicable on the feed.
- `season_unavailable`: page-level banner: "Data for the 2018 World Cup is not available yet."

### 3.2 `src/components/GroupDetail.jsx`

(a) Currently imports `TEAMS` from mock-data.

(b) Replace with `useTeams()`. `getStandings(groupId)` already returns standings; the per-row team lookup uses `teams[row.team]`.

(c) Prop interface (unchanged):
```js
GroupDetail.propTypes = { groupId: PropTypes.string.isRequired }
```
Internal:
```js
const { teams, loading: teamsLoading } = useTeams()
const [standings, setStandings] = useState(null)
```

(d) States:
- Loading: existing spinner.
- Error: row-level error state ("Couldn't load Group A. Retry.").
- Empty: shouldn't happen (a group with no standings = backend bug). Show error.
- `season_unavailable`: bubble to page-level banner.

### 3.3 `src/components/MatchDetail.jsx`

(a) Currently imports `TEAMS, VENUES, MATCH_DETAILS`.

(b) New data source:
- `teams` from `useTeams()`.
- `venues` from a page-level prop (the route loader passes `venues` down) or from a `useVenues()` hook (recommended — cheap, cached).
- `match` from `getMatchById(matchId)`.
- `details` from `getMatchDetails(matchId)`.
- **If `match.status === 'LIVE'`**, attach `subscribeMatch(matchId, ...)` and `subscribeMatchDetails(matchId, ...)` to push subsequent updates onto the same `match` / `details` state slots.

(c) Prop interface: unchanged (`matchId` from route param). New internal hooks pattern:
```js
useEffect(() => {
  let cancelled = false
  let unsubMatch = () => {}
  let unsubDetails = () => {}

  // 1. Initial paint via callable.
  Promise.all([getMatchById(matchId), getMatchDetails(matchId)]).then(([m, d]) => {
    if (cancelled) return
    setMatch(m); setDetails(d)
    // 2. If live, attach Firestore listeners for push updates.
    if (m?.status === 'LIVE') {
      unsubMatch = subscribeMatch(matchId, (next) => next && setMatch(next))
      unsubDetails = subscribeMatchDetails(matchId, (next) => next && setDetails(next))
    }
  })
  return () => { cancelled = true; unsubMatch(); unsubDetails() }
}, [matchId])
```

Important: do not call `setMatch` from both the callable resolve and the first `onSnapshot` fire — that's a double render. The pattern above is fine because the listener attaches *after* the initial setState; the first `onSnapshot` fire is treated as an update, not a duplicate.

(d) States:
- Loading: existing skeleton.
- Error: "Couldn't load this match. Retry." with a retry button that re-runs the effect.
- Empty: `match === null` → "Match not found." (Should be very rare; bad URL.)
- `tier_required`: dim the Stats and Lineup tabs, show inline "Detailed stats require a paid subscription" copy inside those tabs; Timeline + summary still render.
- `season_unavailable`: page-level banner.

### 3.4 `src/components/LineupView.jsx`

(a) Currently imports `LINEUPS, TEAMS`.

(b) Replace `TEAMS` with `useTeams()`. Replace `LINEUPS` with `getLineup(teamCode)` (called once per side, in parallel).

(c) Prop interface today:
```js
LineupView({ match })
```
New prop interface: same. Internal:
```js
const { teams } = useTeams()
const [homeLineup, setHomeLineup] = useState(null)
const [awayLineup, setAwayLineup] = useState(null)
```

(d) States:
- Loading: skeleton pitch (existing).
- Error: "Couldn't load lineups."
- Empty: lineup `null` → "Lineups not yet announced" (only valid for `SCHED` matches > 1 hour out).
- `tier_required`: "Lineups require a paid subscription."

### 3.5 `src/components/StatsView.jsx`

(a) Currently imports `MATCH_DETAILS, TEAMS`.

(b) Replace both: `teams` via `useTeams()`, `stats` come from the parent `MatchDetail` as a prop (`details.stats`) since `MatchDetail` already fetches `getMatchDetails`. No additional fetch here.

(c) New prop interface:
```js
StatsView({ match, stats, teams })  // stats: MatchDetails['stats']
```

(d) States:
- Loading: parent handles.
- Error: parent handles.
- Empty: `stats === null` → "Stats not available yet for this match" (e.g. match hasn't kicked off).
- `tier_required`: "Detailed stats require a paid subscription." This is the most common gated state — historical free-tier matches return summary-only data.

### 3.6 `src/components/TimelineView.jsx`

(a) Currently imports `MATCH_DETAILS, TEAMS`.

(b) Same as StatsView: `teams` via `useTeams()`, `events` come from parent as `details.events`.

(c) New prop interface:
```js
TimelineView({ match, events, teams })
```

(d) States:
- Loading: parent.
- Error: parent.
- Empty: `events.length === 0` → "No events yet" (during early minutes of a live match) or "No events recorded" (for `FT` matches with no goal/card data — historical).

### 3.7 `src/components/LiveCard.jsx`

(a) Currently reads from in-memory state (parent passes `match`).

(b) New behavior:
- Receives `match` as a prop for initial render.
- On mount, if `match.status === 'LIVE'`, attaches `subscribeMatch(match.id, ...)` and updates an internal state slot with the latest snapshot. Falls back to the prop if no snapshot has arrived yet.
- The "minute" ticker (e.g. "67'") comes straight from `match.minute` in the snapshot, not from a local clock interval.

(c) Prop interface:
```js
LiveCard({ match, teams })  // teams is the map from useTeams (or via context)
```

(d) States:
- Loading: parent's responsibility.
- Error from listener: keep showing last snapshot, attach a tiny "reconnecting" dot.
- Empty: N/A — card only renders if a live match exists.

### 3.8 `src/components/MatchCard.jsx`

(a) Currently looks up `TEAMS[match.home]` and `TEAMS[match.away]` from the imported `TEAMS`.

(b) New: `teams` arrives as a prop (passed by the parent list component). This is the single cleanest place to break the import: lists already know they need teams, and threading the map down is one prop.

(c) Prop interface:
```js
MatchCard({ match, teams })
// teams: Record<short, Team>
// match.home / match.away are short codes (e.g. "ARG", "FRA")
```

(d) States: unchanged. If `teams[match.home]` is missing, render the short code as text (graceful degrade). Don't crash.

### 3.9 `src/components/Flag.jsx` (CountryCrest)

(a) Today builds a flag URL from `TEAMS[short].code` (an ISO-2 like `"ar"`).

(b) New: accept either `team` (the v2 team object) or `code` (the lowercase ISO-2 directly). Prefer `team` — callers already have the object.

(c) Prop interface:
```js
Flag({ team })          // preferred
Flag({ code: 'ar' })    // legacy, still supported
```

The component does **not** call `useTeams()` itself — that would be one context read per crest on a feed with 32 of them. Always thread the team object in.

(d) States: a missing/invalid code renders a neutral gray circle with the short code text (the existing fallback).

### 3.10 `src/components/DateStrip.jsx`

(a) No mock-data import today; reads `matches` from props.

(b) Unchanged.

(c) Prop interface unchanged.

(d) States unchanged. Note: `formatShortDate(getNow())` still works because `getNow()` flips to `new Date()` automatically.

### 3.11 `src/components/GroupCard.jsx`

(a) No direct mock-data import (per the inventory in the task), but it uses team names. Confirm during the refactor — if it does reach into `TEAMS`, swap to a `teams` prop.

(b) `teams` prop from parent.

(c) Prop interface: `GroupCard({ group, teams })`.

(d) States unchanged.

### 3.12 `src/components/Header.jsx`, `Intro.jsx`, `Tabs.jsx`, `Pitch.jsx`, `FanRush.jsx`

No data dependency on mock-data per the inventory. Leave alone. (Worth grepping once more during implementation; one stray import is enough to keep the file alive.)

---

## 4. `<TeamsProvider>` — new global state

Why: every component that today reaches into `TEAMS` becomes a candidate for a prop drill or a context read. Teams are loaded exactly once per session (and once per season change), they don't change while the user is on the page, and they're tiny (~32 entries). Context is the right tool.

Location: `src/api/TeamsProvider.jsx`.

API:

```js
const TeamsContext = createContext(null)

export function TeamsProvider({ children }) {
  const season = useSeason() // re-renders on URL season change
  const [state, setState] = useState({ teams: null, loading: true, error: null })

  useEffect(() => {
    let cancelled = false
    setState({ teams: null, loading: true, error: null })
    whenReady
      .then(() => getTeams())
      .then((teams) => { if (!cancelled) setState({ teams, loading: false, error: null }) })
      .catch((error) => { if (!cancelled) setState({ teams: null, loading: false, error }) })
    return () => { cancelled = true }
  }, [season])

  return <TeamsContext.Provider value={state}>{children}</TeamsContext.Provider>
}

export function useTeams() {
  const ctx = useContext(TeamsContext)
  if (!ctx) throw new Error('useTeams must be used inside <TeamsProvider>')
  return ctx
}
```

Return shape:

```ts
{
  teams: Record<short, Team> | null,
  loading: boolean,
  error: FirebaseError | null,
}
```

Fallback behavior when `getTeams()` fails:

1. If the service worker has a cached response for the callable (see §6), the network handler returns it — `getTeams()` resolves normally, error is `null`.
2. If there's no cached response and the error code is `functions/unavailable`, components render their own offline state. The `TeamsProvider` does *not* serve a stale literal from `mock-data.js` — fixture data and live data must not mix in production.
3. If `error.code === 'functions/permission-denied'`, the App Check token failed. Log and show a generic error; this is operations' problem, not the user's.

Mount point: in `src/main.jsx`, wrap `<App />`:

```jsx
<SeasonProvider>
  <TeamsProvider>
    <App />
  </TeamsProvider>
</SeasonProvider>
```

---

## 5. `<SeasonProvider>` (optional, recommended)

Reads `?season=` from `useLocation()` (from `react-router-dom`) and provides:

```js
export function useSeason() {
  // returns the int: 2018 | 2022 | 2026
}
```

The point: React Router has its own re-render lifecycle. If the user toggles `?season=2022` via a future UI selector, every consumer should re-fetch automatically. The cheapest way is a context whose value is `getActiveSeason()` derived from `useLocation().search`.

Sketch:

```js
const SeasonContext = createContext(2026)

export function SeasonProvider({ children }) {
  const { search } = useLocation()
  const season = useMemo(() => {
    const raw = new URLSearchParams(search).get('season')
    const n = Number.parseInt(raw ?? '', 10)
    return [2018, 2022, 2026].includes(n) ? n : 2026
  }, [search])

  // Mirror to the imperative subscribers in season.js.
  useEffect(() => { _notifySeasonChange() }, [season])

  return <SeasonContext.Provider value={season}>{children}</SeasonContext.Provider>
}

export const useSeason = () => useContext(SeasonContext)
```

Why "optional": the app today has no season selector UI. Without the provider, the season can only change via a full navigation (which remounts everything). The provider future-proofs the UI selector and costs ~20 lines.

Recommendation: ship it. It also makes the `useEffect` deps explicit (`[season]`) instead of relying on a stable `getActiveSeason()` value that doesn't trigger re-renders.

---

## 6. Service worker runtime cache

Update `vite.config.js` `VitePWA.workbox.runtimeCaching`:

### 6.1 Existing entry (keep)

```js
{
  urlPattern: ({ url }) => url.hostname === 'flagcdn.com',
  handler: 'CacheFirst',
  options: {
    cacheName: 'flagcdn-images',
    expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
    cacheableResponse: { statuses: [0, 200] },
  },
},
```

### 6.2 New entry — Cloud Functions callable endpoint

Callables hit `https://us-central1-worldcup-live-scores-2026.cloudfunctions.net/<functionName>` via POST. App Check token rides in the `X-Firebase-AppCheck` header. Auth token rides in `Authorization: Bearer <jwt>`.

```js
{
  urlPattern: ({ url }) =>
    url.hostname === 'us-central1-worldcup-live-scores-2026.cloudfunctions.net',
  handler: 'NetworkFirst',
  method: 'POST',
  options: {
    cacheName: 'callables',
    networkTimeoutSeconds: 3,
    expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 }, // 5 min
    cacheableResponse: { statuses: [200] },
    plugins: [
      {
        // Workbox does not key POSTs by body by default. We need to fold the
        // request body into the cache key so two calls to `getMatches` with
        // different `{ season, date }` payloads don't collide.
        cacheKeyWillBeUsed: async ({ request }) => {
          const cloned = request.clone()
          const body = await cloned.text()
          const url = new URL(request.url)
          // Hash the body so we don't include large JSON in the cache key.
          // Subtle-crypto is available in the SW context.
          const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(body))
          const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
          url.searchParams.set('__bodyHash', hex.slice(0, 16))
          return url.toString()
        },
      },
    ],
  },
},
```

Notes:

- `method: 'POST'` is required; the default is GET-only.
- The `cacheKeyWillBeUsed` plugin normalizes per request body. Without it, every POST to `getMatches` would hit/overwrite the same cache slot.
- `networkTimeoutSeconds: 3` means: if the network hasn't replied in 3 s, serve from cache. Good for spotty subway wifi.
- Five-minute TTL is short enough that "live" tables don't go too stale on the homepage; live matches use Firestore listeners anyway and don't depend on this cache for freshness.
- App Check and Auth tokens in headers are ignored by the cache key — that's correct. The response body doesn't depend on which user fetched it (callables are not per-user authorized at the response level).

### 6.3 Firestore long-poll endpoint — **do not cache**

Firestore real-time listeners use a long-poll / WebChannel transport at `https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel`. Cached responses would break realtime. Explicit exclusion:

```js
{
  urlPattern: ({ url }) => url.hostname === 'firestore.googleapis.com',
  handler: 'NetworkOnly',
},
```

Place this entry **before** any wildcard handler so it short-circuits.

---

## 7. Environment variables

All consumed via `import.meta.env`. Public-by-design (`VITE_` prefix means the value ships in the bundle).

| Var | Required | Purpose | Example |
|---|---|---|---|
| `VITE_FIREBASE_API_KEY` | yes | Firebase web SDK key (public, restricted via Firebase project rules) | `AIza...` |
| `VITE_FIREBASE_AUTH_DOMAIN` | yes | Auth handler domain | `worldcup-live-scores-2026.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | yes | Firestore + Functions project | `worldcup-live-scores-2026` |
| `VITE_FIREBASE_APP_ID` | yes | Per-app GA + client id | `1:123:web:abc` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | yes | FCM sender id | `1234567890` |
| `VITE_FIREBASE_STORAGE_BUCKET` | yes | Default storage bucket | `worldcup-live-scores-2026.appspot.com` |
| `VITE_RECAPTCHA_KEY` | yes | App Check reCAPTCHA Enterprise site key (public) | `6Lc...` |
| `VITE_USE_EMULATORS` | no | `'true'` to wire to local emulators | `true` |
| `VITE_FUNCTIONS_REGION` | no | Functions region; default `us-central1` | `us-central1` |

Provide `.env.example` at repo root listing each var with placeholder values. `.env.local` is gitignored. See `05-secrets-ops.md` for how production values are pushed into the build environment (Firebase Hosting build env / CI secrets).

---

## 8. Error & empty states inventory

For every fetch, four states. Copy is sentence-case, no trailing punctuation in headlines.

### `getTeams()`

| State | Copy | UI |
|---|---|---|
| Loading | (skeleton) | App boot spinner; render placeholder grids in feed |
| Error (`unavailable`) | "Couldn't reach the score service." | Page banner + Retry button |
| Empty | "No teams to show." | Never expected; treated as error |
| `tier_required` | N/A | Teams endpoint is free-tier |
| `season_unavailable` | "Data for the {year} World Cup is not available." | Replace page content |

### `getMatches({ status, group, date })`

| State | Copy | UI |
|---|---|---|
| Loading | (skeleton match cards) | 3 placeholders |
| Error | "Couldn't load matches." | Inline retry |
| Empty (filtered) | "No matches today." | Reuse `.detail-fallback` |
| `tier_required` | N/A | Free-tier |
| `season_unavailable` | "Schedule not available." | Inline |

### `getMatchById(id)` + `getMatchDetails(id)`

| State | Copy | UI |
|---|---|---|
| Loading | (skeleton match detail) | existing |
| Error | "Couldn't load this match." | Full-page retry |
| Empty | "Match not found." | 404-style page |
| `tier_required` (details only) | "Detailed stats require a paid subscription." | Per-tab notice; summary still renders |
| `season_unavailable` | "This match isn't available." | Full-page |

### `getStandings(groupId)` / `getGroups()`

| State | Copy | UI |
|---|---|---|
| Loading | (skeleton row × 4) | existing |
| Error | "Couldn't load standings." | Inline retry |
| Empty | "No standings yet." | Pre-tournament state |
| `tier_required` | N/A | Free-tier |
| `season_unavailable` | "Standings not available." | Inline |

### `getLineup(teamCode)`

| State | Copy | UI |
|---|---|---|
| Loading | (pitch skeleton) | existing |
| Error | "Couldn't load lineups." | Inline retry |
| Empty | "Lineups not yet announced." | Until ~1 hour pre-kickoff |
| `tier_required` | "Lineups require a paid subscription." | Per-side notice |
| `season_unavailable` | "Lineups not available." | Inline |

### Reusing existing CSS

The existing `.detail-fallback` class already styles empty/error states (centered, muted copy, optional CTA). Reuse for all states above; do not add new classes unless a new visual treatment is genuinely needed. `tier_required` gets a small lock-icon variant: `.detail-fallback.detail-fallback--gated`.

---

## 9. Real-time wiring details

### 9.1 `MatchDetail.jsx` lifecycle

| `match.status` | On mount | While mounted | On unmount |
|---|---|---|---|
| `SCHED` (scheduled) | `getMatchById` + `getMatchDetails` callables in parallel | nothing (no listener) | nothing |
| `LIVE` | callables fire first (instant from SW cache if warm); then attach `subscribeMatch` + `subscribeMatchDetails` | both listeners stream snapshots | both unsubscribes called |
| `FT` (finished) | callables only | nothing | nothing |
| `POSTP` / `CANC` | callables only | nothing | nothing |

The reason for "callables first, then listeners" on a `LIVE` match: the SW cache means the callable resolves in <50 ms, giving an instant paint. Firestore's first `onSnapshot` fire can take 200–800 ms over a cold connection (TLS + WebChannel handshake). We don't want to stare at a skeleton during the handshake.

To avoid the visible double render (callable result, then immediately the snapshot), gate the listener attach on the callable resolving first (the sketch in §3.3 does this).

### 9.2 `LiveCard` in `MainFeed`

Two options for the "show all currently-live matches" section:

**Option A — poll**: `setInterval(() => getMatches({ status: 'LIVE' }), 30_000)`. Simple, but burns 2× as many callable invocations on every tab worldwide, and still has 30 s latency.

**Option B — subscribe to a tiny index doc**: `meta/liveIndex` holds `{ matchIds: string[], updatedAt }`. The backend updates this doc whenever a match transitions to/from `LIVE`. The client subscribes once via `subscribeLiveIndex`, then for each id renders a `<LiveCard match={...} />` that itself subscribes to `matches/{id}`.

**Recommendation: Option B.**

Trade-offs:

| | Polling | Live index |
|---|---|---|
| Latency to "new live match appears" | up to 30 s | <1 s |
| Cost per client per hour | ~120 callables | 1 listener (+ N per live match) |
| Backend complexity | none | one extra Firestore write per match transition |
| Failure mode | retry next interval | reconnect via Firestore's built-in resume tokens |
| Works offline (last-known) | only via SW cache | yes — Firestore SDK keeps a local cache |

The cost analysis tilts to B once you have >2k concurrent viewers. The "one extra write per transition" is cheap (~2 transitions × 64 matches = 128 writes/tournament).

### 9.3 Listener teardown discipline

Reviewer checklist — every PR that adds a `subscribeX` call must show:

1. The `subscribeX` return value (unsubscribe function) is captured.
2. The captured function is called in the `useEffect` cleanup.
3. If the subscription is conditional, the variable is initialized to a no-op so cleanup is unconditional:
   ```js
   let unsub = () => {}
   if (shouldSubscribe) unsub = subscribeMatch(id, cb)
   return () => unsub()
   ```
4. No subscriptions inside event handlers (only inside effects).
5. No subscriptions inside renders.

A lint rule isn't worth writing for this; the team enforces by review.

---

## 10. Testing

### 10.1 Module-level mocks (recommended over MSW)

`vitest` already runs the suite. For each test that imports a component which transitively imports `firebase/functions` or `firebase/firestore`, mock those modules:

```js
vi.mock('firebase/functions', () => ({
  httpsCallable: () => async (args) => ({ data: matchFixture(args) }),
  getFunctions: () => ({}),
  connectFunctionsEmulator: () => {},
}))

vi.mock('firebase/firestore', () => {
  const listeners = new Map()
  return {
    doc: (_db, col, id) => ({ col, id }),
    onSnapshot: (ref, next) => {
      const key = `${ref.col}/${ref.id}`
      listeners.set(key, next)
      next({ exists: () => true, data: () => fixtureFor(key) })
      return () => listeners.delete(key)
    },
    getFirestore: () => ({}),
    connectFirestoreEmulator: () => {},
    __emit: (key, data) => listeners.get(key)?.({ exists: () => true, data: () => data }),
  }
})
```

Why module mocks over MSW:

- MSW intercepts at the network layer. Firebase SDKs use opaque transports (gRPC-Web, WebChannel) that are painful to fake.
- Module mocks let us drive listener callbacks directly via `__emit`, which is exactly what we need to test "re-renders on snapshot change."
- Smaller dep footprint — no MSW runtime.

### 10.2 New tests

- `src/api/__tests__/scores.test.js` — every exported function returns the v2 shape (see §12).
- `src/api/__tests__/mappers.test.js` — pure-function tests for each mapper.
- `src/api/__tests__/season.test.js` — URL parsing + fallback + allow-list.
- `src/api/__tests__/clock.test.js` — extend the existing file: `getNow()` flips with `?season=`.
- `src/components/__tests__/MatchDetail.live.test.jsx` — mount a `LIVE` match, assert one render after `__emit('matches/<id>', updatedDoc)`.
- `src/components/__tests__/LiveCard.test.jsx` — same idea, simpler scope.

### 10.3 Updated tests

- `src/App.test.jsx` — wrap renders with `<MemoryRouter>` + `<SeasonProvider>` + `<TeamsProvider>` (or a `renderWithProviders` helper). Update snapshots if any.
- `src/api/mock-data.test.js` — keep, but rename to `src/api/__tests__/fixtures.test.js` after the file moves. Tests are still valid against the fixture file.

### 10.4 What we are not testing

- The Firebase SDK itself.
- Service worker runtime caching (covered by manual smoke tests + Lighthouse PWA audit pre-release).
- App Check tokens (covered by the staging environment; if the token works in staging, it works in prod).

---

## 11. Migration steps (dependency order)

Do these in order. Each step is independently shippable behind the seam — at any cut point, the build is green and the app renders. Use a feature branch per step or stack them; do not bundle steps 5 and 6 into one PR.

1. **Land new modules.** `client.js`, `season.js`, `mappers.js`, `live.js`, `formations.js`, and the modified `clock.js`. No call sites change yet. Add unit tests for `season.js`, `clock.js`, `mappers.js`.
2. **Wire `<SeasonProvider>` + `<TeamsProvider>`** at the app root in `src/main.jsx`. `TeamsProvider` currently calls `getTeams()` which still resolves from mock data — that's fine, the seam is intact.
3. **Refactor each leaf component** to read teams from `useTeams()` (or via the new `teams` prop where threading is cheaper than context). Cut imports from `mock-data.js` one by one:
   - `MatchCard.jsx` (prop threaded)
   - `GroupCard.jsx` (prop threaded)
   - `Flag.jsx` (prop threaded; never reads context)
   - `LineupView.jsx` (context)
   - `StatsView.jsx` (context)
   - `TimelineView.jsx` (context)
   - `GroupDetail.jsx` (context)
   - `MatchDetail.jsx` (context, plus prep for `details` shape)
   - `MainFeed.jsx` (context)
4. **Refactor `MatchDetail`** to consume the v2 `details` shape (renamed fields, new `tier` flag).
5. **Replace `scores.js` body** with callable-backed implementations. Smoke-test against the emulator (`VITE_USE_EMULATORS=true`). Verify the in-memory dedup works (open two tabs, both should fire once each, not collide).
6. **Wire live listeners** in `LiveCard` and `MatchDetail`. Verify in the emulator by writing to `matches/{id}` and watching the UI update.
7. **Flip `getNow()`** to use `new Date()` for `season === 2026`. Verify by watching `DateStrip` highlight today's column.
8. **Move mock-data**. Rename `src/api/mock-data.js` → `src/api/fixtures/2022-final.js`. Update the fixture's tests' import paths. The production bundle should no longer include this module (verify via `vite build` + grep the output JS).
9. **Update tests, run lint + test + build**. Resolve any remaining warnings before merging.

Rollback plan: each PR is reverted independently. Steps 5 and 6 (the callable wiring + live listeners) are the riskiest; keep them small and the rollback fast.

---

## 12. Backward-compat guard for the seam

Add `src/api/__tests__/scores.contract.test.js`. The test:

1. Captures a real Firestore-emulator response for each callable (run once, commit the JSON snapshots into `src/api/__tests__/__fixtures__/`).
2. Mocks `httpsCallable` to return the captured response.
3. Asserts each exported function returns a `Promise` of the shape declared in `02-data-contracts.md`.

Sketch:

```js
import * as scores from '../scores.js'
import teamsResponse from './__fixtures__/getTeams.2026.json'
import matchesResponse from './__fixtures__/getMatches.2026.json'

vi.mock('firebase/functions', () => ({
  getFunctions: () => ({}),
  httpsCallable: (_fn, name) => async () => ({ data: respFor(name) }),
}))

function respFor(name) {
  if (name === 'getTeams') return teamsResponse
  if (name === 'getMatches') return matchesResponse
  // ...
}

test('getTeams returns Record<short, Team>', async () => {
  const teams = await scores.getTeams()
  expect(typeof teams).toBe('object')
  for (const [k, v] of Object.entries(teams)) {
    expect(k).toMatch(/^[A-Z]{2,3}$/) // short code
    expect(v).toMatchObject({
      short: expect.any(String),
      name: expect.any(String),
      code: expect.stringMatching(/^[a-z]{2}$/), // lowercase ISO-2 for flag CDN
      group: expect.stringMatching(/^[A-H]$/),
    })
  }
})

test('getMatches returns Match[] with v2 fields', async () => {
  const m = await scores.getMatches()
  expect(Array.isArray(m)).toBe(true)
  for (const x of m) {
    expect(x).toMatchObject({
      id: expect.any(String),
      home: expect.any(String),
      away: expect.any(String),
      status: expect.stringMatching(/^(SCHED|LIVE|FT|HT|POSTP|CANC)$/),
      kickoff: expect.any(String), // ISO-8601
    })
  }
})

// Repeat for getStandings, getMatchById, getMatchDetails, getLineup, getGroups, getVenues, getFormation.
```

Run this in CI on every PR. When the v2 contract changes intentionally, update both the JSON fixtures and the assertions in the same commit.

---

## 13. PWA / install-prompt considerations

App shell + flag cache already work offline today. After the migration:

### 13.1 First-paint with no network

The service worker should serve:

- The app shell (`index.html`, JS, CSS) — already handled by Workbox's precache.
- The last cached `getTeams` response — handled by the NetworkFirst entry in §6.
- The last cached `getMatches` response — same handler.
- Flag images — handled by the existing CacheFirst handler.

Result: a returning user on the subway sees the last-known feed within 200 ms even with zero network. The matches will be stale, but they render.

### 13.2 Offline UX

- **Stale data banner.** When `navigator.onLine === false`, show a thin yellow strip at the top: "You're offline — showing last-known scores." Re-check `navigator.onLine` on `online` and `offline` events.
- **Retry button.** Every error state already has one (§8). When offline, the retry button is grayed out with helper text "Reconnect to retry."
- **Live listeners.** Firestore's SDK transparently handles reconnect; the listener does not need to be torn down on `offline`. When the network returns, the SDK fires the resume tokens automatically. Test this manually with Chrome DevTools' offline toggle.

### 13.3 Install prompt

Unchanged from today. The `beforeinstallprompt` listener (if present) continues to work. The new SW caching does not affect install eligibility.

---

## 14. Cross-references

- **`02-data-contracts.md`** — v2 shape for `Team`, `Match`, `MatchDetails`, `Lineup`, `Standing`, `Stadium/Venue`, `Group`. Every mapper in `src/api/mappers.js` references this doc.
- **`03-backend-functions.md`** — exact callable names, arg shapes, response envelopes. The `scores.js` rewrite reads from here.
- **`05-secrets-ops.md`** — App Check site key provisioning, Vite env var injection in CI, reCAPTCHA Enterprise key rotation, emulator setup.

---

## Appendix A — File-by-file delta summary

| Path | Action |
|---|---|
| `src/api/client.js` | **new** — Firebase + App Check bootstrap |
| `src/api/season.js` | **new** — active-season resolver |
| `src/api/live.js` | **new** — Firestore `onSnapshot` wrappers |
| `src/api/mappers.js` | **new** — v2 shape adapters |
| `src/api/formations.js` | **new** — extracted constant table |
| `src/api/TeamsProvider.jsx` | **new** — context provider + `useTeams` |
| `src/api/SeasonProvider.jsx` | **new** — context provider + `useSeason` |
| `src/api/scores.js` | **rewrite** — same exports, new bodies |
| `src/api/clock.js` | **modify** — `getNow()` honors season |
| `src/api/mock-data.js` | **move** → `src/api/fixtures/2022-final.js` |
| `src/api/mock-data.test.js` | **move** → `src/api/__tests__/fixtures.test.js` |
| `src/api/__tests__/scores.contract.test.js` | **new** — seam contract test |
| `src/api/__tests__/mappers.test.js` | **new** |
| `src/api/__tests__/season.test.js` | **new** |
| `src/api/__tests__/clock.test.js` | **modify** — exercise season-aware `getNow` |
| `src/main.jsx` | **modify** — wrap `<App />` with providers |
| `src/App.jsx` | **no change** |
| `src/App.test.jsx` | **modify** — wrap with providers |
| `src/pages/MainFeed.jsx` | **modify** — drop mock-data import, use hooks |
| `src/pages/GroupDetailPage.jsx` | **no change** (passes through) |
| `src/pages/MatchDetailPage.jsx` | **no change** (passes through) |
| `src/components/MatchDetail.jsx` | **modify** — listeners + v2 shape |
| `src/components/LineupView.jsx` | **modify** — drop mock-data import |
| `src/components/StatsView.jsx` | **modify** — accept stats prop |
| `src/components/TimelineView.jsx` | **modify** — accept events prop |
| `src/components/LiveCard.jsx` | **modify** — Firestore listener |
| `src/components/MatchCard.jsx` | **modify** — accept teams prop |
| `src/components/GroupCard.jsx` | **modify** — accept teams prop (verify) |
| `src/components/GroupDetail.jsx` | **modify** — use `useTeams` |
| `src/components/Flag.jsx` | **modify** — accept team or code prop |
| `src/components/DateStrip.jsx` | **no change** |
| `src/components/Header.jsx` | **no change** |
| `src/components/Intro.jsx` | **no change** |
| `src/components/Tabs.jsx` | **no change** |
| `src/components/Pitch.jsx` | **no change** |
| `src/components/FanRush.jsx` | **no change** |
| `vite.config.js` | **modify** — runtime cache entries |
| `.env.example` | **new** | list all `VITE_*` vars |
| `package.json` | **modify** — add `firebase` dep |

## Appendix B — Definition of done

The migration is complete when **all** of the following are true:

1. `git grep "from '../api/mock-data" src` returns zero matches outside `src/api/fixtures/` and `src/api/__tests__/`.
2. `npm run build` produces a bundle that does not include `mock-data.js` (verify via `grep -l 'MOCK_NOW' dist/assets/*.js` returning nothing).
3. `npm run test` passes, including the new `scores.contract.test.js`.
4. `npm run lint` passes.
5. Manual smoke test against the emulator: home page renders, group page renders, scheduled match renders, live match renders and updates when a `matches/{id}` doc is written.
6. Manual smoke test against staging: same checks, App Check tokens succeed, anonymous auth fires once on boot.
7. Lighthouse PWA score ≥ existing baseline.
8. `?season=2022` URL loads the historical fixtures successfully (via the callable, not the local fixture file — verify by killing the Functions emulator and watching the error state).
