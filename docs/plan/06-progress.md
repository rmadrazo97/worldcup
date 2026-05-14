# Progress Tracker

**Single source of truth for "what's done / what's next".** Sessions and
agents start here. When you pick up work, claim a row (add your handle + date
in the `Owner` column), update the status, and link any PRs in the `Notes`
column.

Status legend: `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked

---

## Quick start for a new session

1. Read `00-overview.md` once.
2. Open this file. Find the first `[ ]` row whose dependencies are `[x]`.
3. Read the spec doc referenced in the row.
4. Claim the row (`[~]` + your handle + today's date).
5. Land a PR. Update to `[x]` with PR link in `Notes`.
6. Append any newly discovered work as a new row at the end of the
   relevant table. Don't silently expand scope.

---

## Plan documents (the contract)

| Doc | Workstream | Status | Notes |
|---|---|---|---|
| `00-overview.md` | — | `[x]` | living |
| `01-architecture.md` | W1 | `[x]` | 635 lines, includes mermaid + ASCII diagrams, TTL table, scheduler design |
| `02-data-contracts.md` | W2 | `[x]` | 935 lines, full field-by-field mapping, status enum, score precedence |
| `03-backend-functions.md` | W3 | `[x]` | 1541 lines, 48-item impl checklist, full file tree |
| `04-frontend-swap.md` | W4 | `[x]` | 1080 lines, component-by-component refactor, real-time wiring |
| `05-secrets-ops.md` | W5 | `[x]` | 909 lines, Secret Manager runbook, full CI YAMLs, Firestore rules |
| `06-progress.md` | W6 | `[x]` | this file |

Plan-doc edits don't need a tracker row — just keep them updated in lockstep
with implementation changes (CI gate from `05-secrets-ops.md` § 7 enforces
this).

---

## M0 — Scaffolding

Exit criteria: emulators boot Functions + Firestore; trivial callable returns `{ ok: true }`. See `00-overview.md` § 6.

| # | Task | Spec | Depends | Status | Owner | Notes |
|---|---|---|---|---|---|---|
| M0.1 | Initialize `functions/` with TS, Node 20, gen 2 | `03-backend-functions.md` § 2 | — | `[ ]` |  |  |
| M0.2 | Add `tsconfig.json`, `.eslintrc.json` in `functions/` | `03-backend-functions.md` § 2 | M0.1 | `[ ]` |  |  |
| M0.3 | Wire `firebase.json` for Functions + Firestore + emulators | `03-backend-functions.md` § 12, `05-secrets-ops.md` § 3 | M0.1 | `[ ]` |  |  |
| M0.4 | Add `firestore.rules` per `05-secrets-ops.md` § 5 | `05-secrets-ops.md` § 5 | M0.3 | `[ ]` |  |  |
| M0.5 | Add `firestore.indexes.json` per `05-secrets-ops.md` § 5 | `05-secrets-ops.md` § 5 | M0.3 | `[ ]` |  |  |
| M0.6 | Set `BALLDONTLIE_API_KEY` in Secret Manager | `05-secrets-ops.md` § 2 | — | `[ ]` |  | use `firebase functions:secrets:set` |
| M0.7 | Add `.env.local` + `functions/.secret.local` to `.gitignore`; create `.env.example` | `04-frontend-swap.md` § 7, `05-secrets-ops.md` § 3 | — | `[ ]` |  |  |
| M0.8 | Add `health` callable returning `{ ok: true }` | `03-backend-functions.md` § 10 | M0.1 | `[ ]` |  |  |
| M0.9 | Smoke-test emulator: `firebase emulators:start --only functions,firestore` | `03-backend-functions.md` § 12 | M0.3, M0.8 | `[ ]` |  |  |
| M0.10 | GitHub Actions `ci.yml` (web + functions + secret-scan + plan-docs gate) | `05-secrets-ops.md` § 7 | M0.1 | `[ ]` |  |  |
| M0.11 | GitHub Actions `deploy-preview.yml` | `05-secrets-ops.md` § 7 | M0.10 | `[ ]` |  |  |
| M0.12 | GitHub Actions `deploy-prod.yml` (Functions before Hosting) | `05-secrets-ops.md` § 7 | M0.10 | `[ ]` |  |  |
| M0.13 | Add `FIREBASE_SERVICE_ACCOUNT` GitHub secret | `05-secrets-ops.md` § 7 | — | `[ ]` |  |  |

---

## M1 — Free-tier endpoints (teams, stadiums, standings)

Exit criteria: group grid + standings render with real team names & flags.

### Backend

| # | Task | Spec | Depends | Status | Owner | Notes |
|---|---|---|---|---|---|---|
| M1.B1 | `functions/src/upstream/client.ts` — `request<T>`, paginate, retry, error classes | `03-backend-functions.md` § 4 | M0.* | `[ ]` |  |  |
| M1.B2 | `functions/src/upstream/types.ts` — TS types mirroring OpenAPI | `02-data-contracts.md` § 3 | — | `[ ]` |  | freeze with `as const` where possible |
| M1.B3 | `functions/src/cache/keys.ts` + `cache/firestore.ts` (`getOrSet`) | `03-backend-functions.md` § 5 | M0.* | `[ ]` |  |  |
| M1.B4 | `functions/src/util/ttl.ts` per-resource table | `01-architecture.md` § 6 | — | `[ ]` |  |  |
| M1.B5 | `functions/src/mappers/team.ts` + tests against fixture | `02-data-contracts.md` § 3, § 5 | M1.B2 | `[ ]` |  | UK home nations + abbreviation override |
| M1.B6 | `functions/src/mappers/stadium.ts` + tests | `02-data-contracts.md` § 3 | M1.B2 | `[ ]` |  | venue short-code synthesis |
| M1.B7 | `functions/src/mappers/standings.ts` (incl. server-side fallback `computeStandings`) | `02-data-contracts.md` § 10 | M1.B2 | `[ ]` |  |  |
| M1.B8 | `functions/src/mappers/group.ts` — synthesizes groups from matches/standings (no upstream `/groups` endpoint) | `02-data-contracts.md` § 7, `03-backend-functions.md` § 6 | M1.B5 | `[ ]` |  |  |
| M1.B9 | `getTeams` callable handler | `03-backend-functions.md` § 6 | M1.B1, M1.B3, M1.B5 | `[ ]` |  |  |
| M1.B10 | `getStadiums` callable handler | `03-backend-functions.md` § 6 | M1.B1, M1.B3, M1.B6 | `[ ]` |  |  |
| M1.B11 | `getGroups` callable handler (synthesized) | `03-backend-functions.md` § 6 | M1.B8 | `[ ]` |  |  |
| M1.B12 | `getStandings` callable handler (with fallback) | `03-backend-functions.md` § 6 | M1.B7 | `[ ]` |  |  |
| M1.B13 | `middleware/appCheck.ts` + `middleware/validate.ts` + zod schemas | `03-backend-functions.md` § 14 | M1.B1 | `[ ]` |  |  |
| M1.B14 | Capture upstream fixtures for teams/stadiums/standings via `npm run record-fixtures` | `03-backend-functions.md` § 11 | M1.B1 | `[ ]` |  | redact key |
| M1.B15 | Emulator integration tests for M1 handlers | `03-backend-functions.md` § 11 | M1.B9–M1.B12 | `[ ]` |  |  |

### Frontend

| # | Task | Spec | Depends | Status | Owner | Notes |
|---|---|---|---|---|---|---|
| M1.F1 | `src/api/client.js` — Firebase + App Check bootstrap | `04-frontend-swap.md` § 2 | M0.* | `[ ]` |  |  |
| M1.F2 | `src/api/season.js` — `getActiveSeason()`, `?season=` parsing | `04-frontend-swap.md` § 2 | — | `[ ]` |  |  |
| M1.F3 | `<SeasonProvider>` + `useSeason()` hook | `04-frontend-swap.md` § 5 | M1.F2 | `[ ]` |  |  |
| M1.F4 | `<TeamsProvider>` + `useTeams()` hook | `04-frontend-swap.md` § 4 | M1.F1 | `[ ]` |  |  |
| M1.F5 | Rewrite `src/api/scores.js` for `getTeams`, `getGroups`, `getStandings`, `getStadiums` | `04-frontend-swap.md` § 2 | M1.F1, M1.F2 | `[ ]` |  | preserve signatures |
| M1.F6 | Refactor `MainFeed.jsx` to consume `useTeams()` + `getStandings()` | `04-frontend-swap.md` § 3 | M1.F4, M1.F5 | `[ ]` |  | remove mock-data import |
| M1.F7 | Refactor `GroupDetail.jsx` to consume `useTeams()` | `04-frontend-swap.md` § 3 | M1.F4 | `[ ]` |  | remove mock-data import |
| M1.F8 | Refactor `MatchCard.jsx`, `LiveCard.jsx`, `Flag.jsx` for teams via context | `04-frontend-swap.md` § 3 | M1.F4 | `[ ]` |  |  |
| M1.F9 | Vite env vars (`VITE_FIREBASE_*`, `VITE_RECAPTCHA_KEY`, `VITE_USE_EMULATORS`) wired + `.env.example` | `04-frontend-swap.md` § 7, `05-secrets-ops.md` § 1 | M0.7 | `[ ]` |  |  |
| M1.F10 | Update `src/App.test.jsx` and add a contract test for `scores.js` | `04-frontend-swap.md` § 12 | M1.F5 | `[ ]` |  |  |

---

## M2 — Match list & detail

Exit criteria: A future match shows correct local-zone kickoff; a 2022 final replay renders end-to-end via `?season=2022`.

### Backend

| # | Task | Spec | Depends | Status | Owner | Notes |
|---|---|---|---|---|---|---|
| M2.B1 | `functions/src/mappers/match.ts` (status enum, score precedence, stage) | `02-data-contracts.md` § 4, § 7, § 8 | M1.B2 | `[ ]` |  |  |
| M2.B2 | `getMatches` callable handler (with cursor pagination) | `03-backend-functions.md` § 6 | M1.B1, M1.B3, M2.B1 | `[ ]` |  |  |
| M2.B3 | `getMatchById` callable handler | `03-backend-functions.md` § 6 | M2.B1 | `[ ]` |  |  |
| M2.B4 | Fixtures for `/matches` (2022 final + 2026 group match) | `03-backend-functions.md` § 11 | M2.B1 | `[ ]` |  |  |
| M2.B5 | Emulator integration tests for M2 handlers | `03-backend-functions.md` § 11 | M2.B2, M2.B3 | `[ ]` |  |  |

### Frontend

| # | Task | Spec | Depends | Status | Owner | Notes |
|---|---|---|---|---|---|---|
| M2.F1 | Extend `src/api/scores.js`: `getMatches`, `getMatchById` | `04-frontend-swap.md` § 2 | M1.F5, M2.B2 | `[ ]` |  |  |
| M2.F2 | Update `clock.js` `getNow()` → `new Date()` in prod; season-locked freeze for `?season=2018|2022` | `04-frontend-swap.md` § 2 | M1.F2 | `[ ]` |  |  |
| M2.F3 | Refactor `MainFeed` for live + today's matches from API | `04-frontend-swap.md` § 3 | M2.F1 | `[ ]` |  |  |
| M2.F4 | Refactor `MatchDetail` summary card (real match) | `04-frontend-swap.md` § 3 | M2.F1 | `[ ]` |  |  |
| M2.F5 | Local-TZ kickoff string derivation in selectors (drop hardcoded `kickoff`) | `02-data-contracts.md` § 6 | M2.F1 | `[ ]` |  |  |
| M2.F6 | Stage label rendering for KO matches (`stage_label`) | `02-data-contracts.md` § 7 | M2.F4 | `[ ]` |  |  |
| M2.F7 | Update `DateStrip` for any data shape changes | `04-frontend-swap.md` § 3 | M2.F3 | `[ ]` |  |  |

---

## M3 — Match detail tabs

Exit criteria: Historical match shows real lineup, real timeline, real stats.

### Backend

| # | Task | Spec | Depends | Status | Owner | Notes |
|---|---|---|---|---|---|---|
| M3.B1 | `mappers/lineup.ts` (formation + starters + subs) | `02-data-contracts.md` § 3 | M1.B2 | `[ ]` |  |  |
| M3.B2 | `mappers/event.ts` (discriminated union) | `02-data-contracts.md` § 3 | M1.B2 | `[ ]` |  |  |
| M3.B3 | `mappers/team-stats.ts` (canonical label set + xG flag) | `02-data-contracts.md` § 3 | M1.B2 | `[ ]` |  |  |
| M3.B4 | `getLineups` callable handler | `03-backend-functions.md` § 6 | M3.B1 | `[ ]` |  |  |
| M3.B5 | `getMatchDetails` composite handler (lineups + events + team stats) | `03-backend-functions.md` § 7 | M3.B1–M3.B3 | `[ ]` |  | partial-failure tolerance |
| M3.B6 | Fixtures for lineups/events/team_match_stats | `03-backend-functions.md` § 11 | M3.B1–M3.B3 | `[ ]` |  |  |
| M3.B7 | Emulator integration tests | `03-backend-functions.md` § 11 | M3.B4, M3.B5 | `[ ]` |  |  |

### Frontend

| # | Task | Spec | Depends | Status | Owner | Notes |
|---|---|---|---|---|---|---|
| M3.F1 | Extend `src/api/scores.js`: `getMatchDetails`, `getLineup` | `04-frontend-swap.md` § 2 | M1.F5, M3.B4, M3.B5 | `[ ]` |  |  |
| M3.F2 | `src/api/formations.js` — pitch coordinate constants (extracted from old mock-data) | `04-frontend-swap.md` § 2 | — | `[ ]` |  | client-side lookup |
| M3.F3 | Refactor `LineupView` to consume v2 lineup shape | `04-frontend-swap.md` § 3 | M3.F1 | `[ ]` |  | remove mock-data import |
| M3.F4 | Refactor `StatsView` to consume v2 stats shape (canonical label set) | `04-frontend-swap.md` § 3 | M3.F1 | `[ ]` |  | remove mock-data import |
| M3.F5 | Refactor `TimelineView` to consume v2 event union | `04-frontend-swap.md` § 3 | M3.F1 | `[ ]` |  | remove mock-data import |
| M3.F6 | Add `tier_required` empty state to all three tabs | `04-frontend-swap.md` § 8 | M3.F3–F5 | `[ ]` |  |  |
| M3.F7 | Delete `src/api/mock-data.js` from production paths; move retained fixtures to `src/api/fixtures/` | `04-frontend-swap.md` § 11 | all M3.F | `[ ]` |  | grep verifies no prod imports |
| M3.F8 | Update + extend tests for tab views | `04-frontend-swap.md` § 10 | M3.F3–F5 | `[ ]` |  |  |

---

## M4 — Live updates

Exit criteria: Live score updates within ≤ 60 s with no client-side polling.

### Backend

| # | Task | Spec | Depends | Status | Owner | Notes |
|---|---|---|---|---|---|---|
| M4.B1 | `schedulers/refreshLiveMatches.ts` (adaptive 30 s / 5 min) | `03-backend-functions.md` § 8 | M2.B*, M3.B5 | `[ ]` |  |  |
| M4.B2 | `schedulers/refreshFixtures.ts` (daily 04:00 UTC) | `03-backend-functions.md` § 8 | M2.B2 | `[ ]` |  |  |
| M4.B3 | `schedulers/refreshStandings.ts` (every 10 min during matchdays) | `03-backend-functions.md` § 8 | M1.B12 | `[ ]` |  |  |
| M4.B4 | `meta/health` doc (live window flag) + `meta/scheduler_state` | `01-architecture.md` § 7 | M4.B1 | `[ ]` |  |  |
| M4.B5 | Token bucket in `meta/rate_buckets/{uid}` + transactional decrement | `03-backend-functions.md` § 9 | — | `[ ]` |  |  |

### Frontend

| # | Task | Spec | Depends | Status | Owner | Notes |
|---|---|---|---|---|---|---|
| M4.F1 | `src/api/live.js` — `subscribeMatch`, `subscribeMatchDetails` | `04-frontend-swap.md` § 2 | M1.F1 | `[ ]` |  |  |
| M4.F2 | Wire listener in `MatchDetail` for `LIVE` matches (initial callable + then snapshot) | `04-frontend-swap.md` § 9 | M4.F1, M3.F* | `[ ]` |  | cleanup on unmount |
| M4.F3 | Wire listener in `LiveCard` / `LiveSection` using `meta/liveIndex` | `04-frontend-swap.md` § 9 | M4.F1 | `[ ]` |  |  |
| M4.F4 | Manual QA on 2022 group-stage replay end-to-end | `00-overview.md` § 6 | all | `[ ]` |  |  |

---

## M5 — Hardening & ship

Exit criteria: `npm run deploy:prod` from a clean clone with only Secret Manager set; alerting fires on simulated outage.

| # | Task | Spec | Depends | Status | Owner | Notes |
|---|---|---|---|---|---|---|
| M5.1 | App Check enforced on every callable (`enforceAppCheck: true`) audit | `05-secrets-ops.md` § 4 | M1–M4 | `[ ]` |  |  |
| M5.2 | App Check reCAPTCHA Enterprise key registered for all hosting + localhost | `05-secrets-ops.md` § 4 | — | `[ ]` |  |  |
| M5.3 | Cloud Monitoring alert policies (error rate, p95, upstream 4xx, cache hit) | `05-secrets-ops.md` § 8 | M1.B1 | `[ ]` |  |  |
| M5.4 | Uptime check on `health` function | `05-secrets-ops.md` § 8 | M0.8 | `[ ]` |  |  |
| M5.5 | Daily Firestore export to GCS w/ 30-day lifecycle | `05-secrets-ops.md` § 10 | — | `[ ]` |  |  |
| M5.6 | Budget alert ($25/mo by default; raise per `05-secrets-ops.md` § 9) | `05-secrets-ops.md` § 9 | — | `[ ]` |  |  |
| M5.7 | Lighthouse PWA check in CI on preview channel | `05-secrets-ops.md` § 11 | M0.11 | `[ ]` |  |  |
| M5.8 | axe-core a11y run in CI | `05-secrets-ops.md` § 11 | M0.10 | `[ ]` |  |  |
| M5.9 | Bundle-size budget enforced (≤ 200 KB gz initial) | `05-secrets-ops.md` § 11 | M0.10 | `[ ]` |  |  |
| M5.10 | Service worker runtime cache: callable POST cache + Firestore exclusion | `04-frontend-swap.md` § 6 | M1.F5 | `[ ]` |  |  |
| M5.11 | Runbook drill — simulate upstream outage, verify alerts + degraded UX | `05-secrets-ops.md` § 12 | M5.3 | `[ ]` |  |  |
| M5.12 | Runbook drill — rotate `BALLDONTLIE_API_KEY` end-to-end | `05-secrets-ops.md` § 12 | M0.6 | `[ ]` |  |  |
| M5.13 | Tag `v1.0.0` release | `05-secrets-ops.md` § 14 | all | `[ ]` |  |  |

---

## Cross-cutting & continuous

| # | Task | Spec | Status | Notes |
|---|---|---|---|---|
| C1 | Plan-docs CI gate (changes under `src/api/` or `functions/src/` must touch `docs/plan/`) | `05-secrets-ops.md` § 7 | `[ ]` |  |
| C2 | `npm run record-fixtures` script (rare, manual) | `03-backend-functions.md` § 11 | `[ ]` |  |
| C3 | `npm run seed` script (populate emulator from fixtures) | `03-backend-functions.md` § 12 | `[ ]` |  |
| C4 | Per-resource mapper coverage ≥ 80 % | `05-secrets-ops.md` § 11 | `[ ]` |  |
| C5 | Update `docs/plan/CHANGELOG.md` on every schema bump | `02-data-contracts.md` § 11 | `[ ]` |  | create on first bump |

---

## Decisions log (append-only)

Record decisions that diverge from or refine a plan doc. Date, brief.

| Date | Decision | Reference |
|---|---|---|
| 2026-05-14 | Backend = cache-aside via Firestore (not pure proxy, not scheduled-only). | user, ratified in `00-overview.md` § 2 |
| 2026-05-14 | Season default 2026, `?season=2018\|2022` query override. | user, ratified in `00-overview.md` § 4 |
| 2026-05-14 | Plan for GOAT tier in production; soft-empty for 401/402/403. | user, ratified in `00-overview.md` § 4 |
| 2026-05-14 | Plan docs live under `docs/plan/`, tracked in git. | user, ratified in `00-overview.md` |
| 2026-05-14 | All callables protected by App Check (reCAPTCHA Enterprise on web). | `05-secrets-ops.md` § 4 |
| 2026-05-14 | Region `us-central1` for Functions + Firestore. | `03-backend-functions.md` § 3 |

---

## Open questions parked

Things the plan currently marks as TBD or open. Resolve in flight; add a row here when you find an answer.

| # | Question | Where it lives | Owner | Status |
|---|---|---|---|---|
| Q1 | balldontlie GOAT rate limit (assumed 300 req/min) | `01-architecture.md` § 8 |  | `[ ]` |
| Q2 | Authorization header literal form (`Bearer <key>` vs `<key>` vs custom) | `03-backend-functions.md` § 4 |  | `[ ]` |
| Q3 | Array query encoding for `seasons[]`, `match_ids[]` | `03-backend-functions.md` § 4 |  | `[ ]` |
| Q4 | xG availability per season (2018/2022) | `02-data-contracts.md` § Open |  | `[ ]` |
| Q5 | KO `stage` field shape before brackets are set | `02-data-contracts.md` § Open |  | `[ ]` |
| Q6 | Venue short-code strategy: synthesize vs override map | `02-data-contracts.md` § Open |  | `[ ]` |
| Q7 | `home_score` semantics after ET (running total vs regulation only) | `02-data-contracts.md` § Open |  | `[ ]` |
| Q8 | Attendance fields (mapped from where?) | `02-data-contracts.md` § Open |  | `[ ]` |
| Q9 | Slack/email destination for alerts | `05-secrets-ops.md` § 8 |  | `[ ]` |
