# World Cup 2026 — Production Migration Plan

**Status:** active · **Owner:** team · **Last updated:** 2026-05-14

This is the master execution plan for replacing every piece of dummy data in the
`worldcup-pwa` codebase with live data from the **balldontlie.io FIFA World Cup
API**, fronted by **Firebase Cloud Functions** with a **Firestore cache** so the
upstream API key never reaches the client.

The plan is split across the files in this folder. Read this overview first,
then drill into the spec for the area you're working on. The progress tracker
(`06-progress.md`) is the single source of truth for "what's done / what's
next" across sessions and agents.

---

## 1. Goals

| # | Goal | Done when… |
|---|---|---|
| G1 | Eliminate `src/api/mock-data.js` as a runtime dependency | No production code path imports it; only tests / fixtures may. |
| G2 | All team, group, match, lineup, event, stats, player data comes from balldontlie | A network-disabled run renders empty states only — never invented values. |
| G3 | No API credentials in client bundle | `grep -r 'balldontlie' dist/` is empty. Audit `npm run build` output. |
| G4 | Live scores feel live | Live matches & their events/stats refresh on a sub-minute cadence in the browser without manual reload. |
| G5 | Tournament selectable for testing | `?season=2022` switches the entire app to the 2022 World Cup; default is 2026. |
| G6 | Production-ready | Deployable to Firebase Hosting + Functions with CI; has runbook, error budgets, and an on-call story. |

Non-goals (this plan): native iOS/Android, push notifications, auth/accounts,
in-app betting odds UI, monetization, internationalization.

---

## 2. Architecture at a glance

```
┌──────────────┐      HTTPS callable / onRequest      ┌──────────────────────┐
│  React PWA   │ ───────────────────────────────────▶ │  Cloud Functions     │
│  (Vite)      │                                      │  (Node 20, gen 2)    │
│              │                                      │                      │
│  scores.js   │                                      │  - cache check       │
│   ↑          │                                      │  - upstream fetch    │
│   listens to │                                      │  - mapper → internal │
│   Firestore  │ ◀──── snapshot listener ───────────▶ │  - Firestore write   │
│   for live   │       (LIVE matches only)            │  - return JSON       │
└──────────────┘                                      └──────────┬───────────┘
                                                                 │
                                                                 ▼
                                                       ┌──────────────────────┐
                                                       │  Firestore (cache)   │
                                                       │  TTL per resource    │
                                                       │  see 02-data-contr.. │
                                                       └──────────┬───────────┘
                                                                  │
                                                                  ▼
                                                       ┌──────────────────────┐
                                                       │ balldontlie.io       │
                                                       │ /fifa/worldcup/v1/*  │
                                                       └──────────────────────┘
```

- **Cache-aside, write-through.** Every Function checks Firestore for a
  non-stale doc keyed by request shape. Cache miss / stale → fetch upstream,
  map, write, return.
- **Live matches push.** A scheduled Function (every 30 s) re-fetches
  `matches`, `match_events`, `team_match_stats`, `match_lineups` for any match
  whose status is `LIVE`. The client subscribes to Firestore documents for the
  match it's viewing — no client-side polling.
- **No client → balldontlie.** The API key lives only in Firebase Secret
  Manager; Functions inject it server-side.

Full architecture diagram, sequence diagrams, cache-key conventions, and TTL
table: `01-architecture.md`.

---

## 3. Data flow today vs. tomorrow

```
TODAY                                       TOMORROW
─────                                       ────────
Components ─▶ scores.js ─▶ mock-data.js     Components ─▶ scores.js ─▶ fetch CF ─▶ Firestore + balldontlie
            └ direct import (legacy)                     └ Firestore listener (LIVE only)
```

Direct imports of `mock-data.js` that must be removed:

| File | Imports | Target |
|---|---|---|
| `src/pages/MainFeed.jsx` | `TEAMS`, `VENUES`, `computeStandings` | go through scores.js |
| `src/components/GroupDetail.jsx` | `TEAMS` | go through scores.js |
| `src/components/MatchDetail.jsx` | `TEAMS`, `VENUES`, `MATCH_DETAILS` | go through scores.js |
| `src/components/LineupView.jsx` | `LINEUPS`, `TEAMS` | go through scores.js |
| `src/components/StatsView.jsx` | `MATCH_DETAILS`, `TEAMS` | go through scores.js |
| `src/components/TimelineView.jsx` | `MATCH_DETAILS`, `TEAMS` | go through scores.js |

Full refactor plan, per-component prop changes, loading/error skeletons, and
the new internal data shape: `04-frontend-swap.md`.

---

## 4. Subscription tier & season handling

- **Tier:** Production assumes a **GOAT** key (matches, players, lineups,
  events, stats, shots, momentum). The test key `d7424a3d-…` provided for
  development may or may not have GOAT — Functions treat `401/402/403` from
  upstream as a soft failure that returns an empty `data` array with a
  `tier_required` flag the UI can surface as "Data unavailable in this
  environment" rather than crashing.
- **Season:** `2026` is the default. The client reads `?season=2022` or
  `?season=2018` from the URL query string and threads it into every
  scores.js call. Functions accept `season` as a parameter and key the cache
  on it. See `02-data-contracts.md` § Season propagation.

---

## 5. Workstreams & ownership

Six workstreams. Each maps to one spec doc. Numbered in dependency order — work
later workstreams only after their dependencies are at least drafted.

| # | Workstream | Spec | Depends on | Can parallelize with |
|---|---|---|---|---|
| W1 | Architecture & cache strategy | `01-architecture.md` | — | W2, W5 |
| W2 | Data contracts & mappers | `02-data-contracts.md` | — | W1, W5 |
| W3 | Cloud Functions implementation | `03-backend-functions.md` | W1, W2 | W4 |
| W4 | Frontend swap & UI states | `04-frontend-swap.md` | W2 | W3 |
| W5 | Secrets, ops & quality | `05-secrets-ops.md` | — | all |
| W6 | Progress / runbook | `06-progress.md` | continuous | — |

When picking up work in a new session: open `06-progress.md`, find the first
unchecked task whose dependencies are checked, claim it (add your name + date),
then go.

---

## 6. Milestones

Suggested cadence. Each milestone is a shippable increment.

### M0 — Scaffolding (≈ 1 day)
- Add `functions/` directory with TypeScript Cloud Functions setup (Node 20,
  gen 2, eslint).
- Wire `firebase.json` for Functions + emulators.
- Add `firestore.rules`, `firestore.indexes.json`.
- Set up GitHub Actions: lint, test, build for both `src/` and `functions/`.
- Secret `BALLDONTLIE_API_KEY` written to Secret Manager (never to git).
- **Exit criteria:** `firebase emulators:start` boots Functions + Firestore;
  one trivial callable returns `{ ok: true }`.

### M1 — Free tier endpoints (≈ 1 day)
- Functions: `getTeams`, `getStadiums`, `getGroupStandings`.
- Mappers: balldontlie team → internal team shape (with flagcdn code).
- Frontend: `MainFeed` group cards + `GroupDetail` standings come from
  Firestore-via-Function path. Mock data still wired for matches.
- **Exit criteria:** Group grid + standings render with real team names &
  flags from the API.

### M2 — Match list & detail (≈ 2 days)
- Functions: `getMatches`, `getMatchById`.
- Mappers: status enum, kickoff datetime → local TZ string, venue → display.
- Frontend: `MainFeed` today's matches, live section, `MatchDetail` summary
  card all real-data driven.
- `clock.js` getNow() flipped to `new Date()` (mock fallback gated behind
  `?season=2022|2018`).
- **Exit criteria:** A future match shows correct kickoff in the user's local
  zone; a 2022 final replay renders end-to-end via `?season=2022`.

### M3 — Match detail tabs (≈ 2 days)
- Functions: `getMatchLineups`, `getMatchEvents`, `getTeamMatchStats`,
  `getPlayerMatchStats` (read but not surfaced in UI yet).
- Mappers: roster → starters/subs; events → timeline; team_match_stats →
  StatsView rows.
- Frontend: `LineupView`, `StatsView`, `TimelineView` are real-data driven
  with skeleton + empty states already in place.
- **Exit criteria:** A historical match (e.g. 2022 final via `?season=2022`)
  shows real lineup, real timeline, real stats.

### M4 — Live updates (≈ 1 day)
- Scheduler: `refreshLiveMatches` runs every 30 s. Re-fetches matches and any
  in-progress match's events/stats.
- Frontend: For a `LIVE` match, subscribe to the Firestore doc instead of
  polling the callable. `LiveCard` and `MatchDetail` rerender on snapshot.
- **Exit criteria:** Score on a live match updates within ≤ 60 s of the API
  reflecting it; no client-side polling timers.

### M5 — Hardening & ship (≈ 1 day)
- Firebase App Check (reCAPTCHA Enterprise) on all callables.
- Error logging → Cloud Logging / Error Reporting; alert on 5xx > 1 %.
- Rate limiting per anonymous Auth UID on callables.
- Lighthouse PWA score regression check in CI.
- Runbook (`05-secrets-ops.md` § Runbook).
- **Exit criteria:** `npm run deploy:prod` succeeds from a clean clone with
  only the Secret Manager value set; alerting fires on a simulated upstream
  outage.

---

## 7. Repository layout (target)

```
.
├── docs/
│   └── plan/                       # this folder
├── functions/                      # Cloud Functions (new)
│   ├── src/
│   │   ├── index.ts                # function exports
│   │   ├── handlers/               # one file per endpoint
│   │   ├── upstream/               # balldontlie client + types
│   │   ├── cache/                  # Firestore read/write helpers
│   │   ├── mappers/                # upstream → internal mappers
│   │   └── schedulers/             # refreshLiveMatches, refreshFixtures
│   ├── test/
│   ├── package.json
│   └── tsconfig.json
├── src/                            # unchanged shape, mock-data.js → fixtures
│   └── api/
│       ├── client.js               # callable + Firestore listener helpers
│       ├── scores.js               # thin wrappers, same signatures
│       ├── clock.js                # getNow() returns new Date() in prod
│       └── fixtures/               # snapshots of API responses for tests
├── firestore.rules
├── firestore.indexes.json
└── firebase.json                   # adds functions + firestore + emulators
```

---

## 8. Conventions

- **No secrets in git.** Ever. CI rejects PRs containing strings matching the
  API key regex.
- **Internal shape ≠ upstream shape.** Components consume only the internal
  shape declared in `02-data-contracts.md`. Mappers are the only place
  upstream field names appear.
- **Public function signatures in `src/api/scores.js` do not change.** The
  swap is body-only; components stay untouched as much as possible.
- **Every Function has a fixture-backed unit test.** No mocking the network
  in tests — replay recorded JSON.
- **Plan docs are the contract.** If you change a contract, update the doc in
  the same commit. CI checks that any change under `functions/src/` or
  `src/api/` touches at least one doc under `docs/plan/`.

---

## 9. Reading order for new contributors / agents

1. This file.
2. `06-progress.md` — what's done, what's next, who's holding what.
3. The spec doc for your workstream.
4. The README at the repo root — codebase conventions still apply.

---

## 10. Index of plan docs

| File | Workstream | Status |
|---|---|---|
| `00-overview.md` | — | living document |
| `01-architecture.md` | W1 — Architecture & cache | drafted |
| `02-data-contracts.md` | W2 — Data contracts | drafted |
| `03-backend-functions.md` | W3 — Cloud Functions | drafted |
| `04-frontend-swap.md` | W4 — Frontend swap | drafted |
| `05-secrets-ops.md` | W5 — Secrets / ops / quality | drafted |
| `06-progress.md` | W6 — Progress tracker | living document |
