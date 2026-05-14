# Deployment Guide — World Cup 2026 PWA

Step-by-step "zero to production" runbook. Pair this with the implementation
docs under [`docs/plan/`](./plan/). When you're done with this file, **every
push to `main`** automatically lints, tests, builds, and deploys Functions →
Firestore → Hosting to Firebase. Pull requests get ephemeral hosting preview
URLs.

> Estimated wall-clock time the first time through: **45–60 minutes**.
> Steps 1–6 are one-time setup; steps 7–10 are recurring.

---

## 0. Prerequisites

- A Google account with billing enabled. Firebase Functions v2 + Firestore +
  Cloud Scheduler all need a **Blaze (pay-as-you-go)** plan. Expected steady-state
  cost is < $25/month for this app; see `docs/plan/01-architecture.md` § 12.
- The `gcloud` and `firebase` CLIs installed locally:
  ```bash
  npm i -g firebase-tools
  curl https://sdk.cloud.google.com | bash && exec -l $SHELL
  firebase login
  gcloud auth login
  ```
- Admin access to the GitHub repo `rmadrazo97/worldcup`.
- A working `balldontlie.io` account with a **GOAT-tier** API key — see
  `docs/plan/00-overview.md` § 4 for why this tier is needed. The test key
  shipped in plan docs (`d7424a3d-…`) works in dev but should not be used in
  prod.

---

## 1. Create / select the Firebase project

The `.firebaserc` already pins:

```
"projects": { "default": "worldcup-live-scores-2026" }
```

If you're starting from scratch:

```bash
firebase projects:create worldcup-live-scores-2026 --display-name "World Cup 2026"
firebase use worldcup-live-scores-2026
```

Upgrade the project to **Blaze** in the Firebase Console
(Settings → Usage and billing → Modify plan). Functions v2 and Cloud
Scheduler require Blaze.

Enable the APIs Cloud Functions + Firestore + Scheduler need:

```bash
gcloud config set project worldcup-live-scores-2026
gcloud services enable \
  cloudfunctions.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  cloudscheduler.googleapis.com \
  firestore.googleapis.com \
  secretmanager.googleapis.com \
  recaptchaenterprise.googleapis.com \
  firebaseappcheck.googleapis.com \
  run.googleapis.com
```

Pick a **Firestore location** that matches your Functions region. We use
`us-central1` for Functions (see `functions/src/config.ts`); Firestore should
be `nam5` (multi-region) or `us-central` (regional).

```bash
gcloud firestore databases create --location=nam5
```

---

## 2. Provision the API key as a Firebase secret

The balldontlie.io key lives **only** in Google Secret Manager — never on
disk in git, never in env files committed to source. Cloud Functions read it
via `defineSecret('BALLDONTLIE_API_KEY')` at runtime.

```bash
cd functions
firebase functions:secrets:set BALLDONTLIE_API_KEY
# Paste the GOAT-tier key at the prompt. Do not paste it into your shell history.
```

Verify (the value is shown once after creation, masked otherwise):

```bash
firebase functions:secrets:access BALLDONTLIE_API_KEY
```

To rotate the key later, repeat `secrets:set` with the new value and redeploy
Functions (`firebase deploy --only functions`). See
[`docs/plan/05-secrets-ops.md`](./plan/05-secrets-ops.md) § 12 → "Incident:
API key compromised".

---

## 3. Register the web app + App Check (reCAPTCHA Enterprise)

### 3a. Web app config

In the Firebase Console → Project Settings → **Your apps** → Add app → Web.
Name it `worldcup-pwa`. Don't enable Hosting setup (we already have it).

Copy the config values into `.env.local` (gitignored). Use `.env.example` as
the template:

```bash
cp .env.example .env.local
# Fill in VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, …
```

These values are **public by design** (they're embedded in the client bundle).
What protects them is App Check + Firestore rules + Function-level App Check
enforcement.

### 3b. reCAPTCHA Enterprise site key

1. Go to Google Cloud Console → Security → **reCAPTCHA Enterprise** → Create
   key.
2. Type: **Website**. Domains: list your hosting domain
   (`worldcup-live-scores-2026.web.app`,
   `worldcup-live-scores-2026.firebaseapp.com`) and `localhost` for dev.
3. Copy the resulting **site key**. Put it in `.env.local` as
   `VITE_RECAPTCHA_KEY=…`. This site key is also public.

### 3c. Wire App Check enforcement

In Firebase Console → **App Check** → Web app → Register the same reCAPTCHA
key.

Then go to **APIs** in App Check and set **enforce** on each Cloud Function
(start with **Monitor** for 24h first if you want to verify token traffic before
hard-enforcing):

- `getTeams`, `getStadiums`, `getGroups`, `getStandings`, `getMatches`,
  `getMatchById`, `getMatchDetails`, `getLineup`

The server side is already enforced via `enforceAppCheck: true` in
`functions/src/middleware/appCheck.ts` (CI gates each handler — see
`.github/workflows/ci.yml` § `app-check-gate`).

### 3d. Debug token for local dev

Set `VITE_USE_EMULATORS=true` in `.env.local`. The client (in
`src/api/client.js`) sets `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true` in that
mode, which causes the SDK to print a debug token on first load. Register
that token in the App Check console under your web app (Debug tokens) so the
emulator path can call your dev Functions through App Check enforcement.

---

## 4. Apply Firestore rules + indexes + TTL policies

The first manual deploy of rules + indexes (CI will handle subsequent ones):

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

The rules (in `firestore.rules`) make the cache collections **publicly
readable** (intentional — score data is not sensitive; see
`docs/plan/05-secrets-ops.md` § 5) but block all writes outside the Admin SDK.

### TTL policies — one-time per collection

Firestore's native TTL service is what removes expired cache docs (apart from
those pinned `_frozen: true`). Configure once per collection:

```bash
gcloud firestore fields ttls update _expiresAt \
  --collection-group=teams --enable-ttl
gcloud firestore fields ttls update _expiresAt \
  --collection-group=stadiums --enable-ttl
gcloud firestore fields ttls update _expiresAt \
  --collection-group=matches --enable-ttl
gcloud firestore fields ttls update _expiresAt \
  --collection-group=matchDetails --enable-ttl
gcloud firestore fields ttls update _expiresAt \
  --collection-group=lineups --enable-ttl
gcloud firestore fields ttls update _expiresAt \
  --collection-group=standings --enable-ttl
gcloud firestore fields ttls update _expiresAt \
  --collection-group=groups --enable-ttl

# Verify
gcloud firestore fields ttls list
```

Frozen docs are safe — they store `_expiresAt` at year-9999 so TTL never
evicts them (see `functions/src/util/ttl.ts` `FROZEN_EXPIRES_AT_MS`).

---

## 5. Create the GitHub Actions service account

This account is what CI uses to deploy. It has narrow IAM and lives only in
GitHub Secrets.

```bash
PROJECT_ID=worldcup-live-scores-2026
SA_NAME=gh-actions-deployer
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud iam service-accounts create $SA_NAME \
  --project=$PROJECT_ID \
  --display-name="GitHub Actions deployer"

# Minimum roles — DO NOT use roles/owner.
for role in \
  roles/firebase.admin \
  roles/cloudfunctions.admin \
  roles/run.admin \
  roles/iam.serviceAccountUser \
  roles/datastore.user \
  roles/cloudscheduler.admin \
  roles/secretmanager.secretAccessor
do
  gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="$role"
done

# Create + download a key (keep this file off disk — copy contents to GitHub immediately).
gcloud iam service-accounts keys create /tmp/sa-key.json \
  --iam-account="${SA_EMAIL}"
```

### Put the key in GitHub

Repository → **Settings → Secrets and variables → Actions → New secret**:

| Name                       | Value                                          |
| -------------------------- | ---------------------------------------------- |
| `FIREBASE_SERVICE_ACCOUNT` | base64-encoded contents of `/tmp/sa-key.json`  |

```bash
# macOS
base64 -i /tmp/sa-key.json | pbcopy
# Linux
base64 -w 0 /tmp/sa-key.json
```

Then **delete the local key**:

```bash
shred -u /tmp/sa-key.json
```

### Other GitHub secrets

| Secret                       | Purpose                                                   | Where it comes from                          |
| ---------------------------- | --------------------------------------------------------- | -------------------------------------------- |
| `FIREBASE_SERVICE_ACCOUNT`   | Deploy auth                                               | Step above                                   |
| `GITLEAKS_LICENSE`           | (Optional) Pro gitleaks features                          | gitleaks.io — free is fine                   |

GitHub variables (not secrets — `Settings → Variables → Actions`):

| Variable                | Default                       |
| ----------------------- | ----------------------------- |
| `FIREBASE_PROJECT_ID`   | `worldcup-live-scores-2026`   |

Branch protection on `main` (repo Settings → Branches → Add rule):
- Require status checks to pass: `web`, `functions`, `secret-scan`,
  `plan-docs`, `app-check-gate`.
- Require pull request reviews before merging: 1 approval.
- Disallow force-push.

---

## 6. First manual deploy (smoke test before turning on CI)

From a clean checkout of `main` with `.env.local` filled in:

```bash
# Install
npm ci
cd functions && npm ci && cd ..

# Verify locally
npm run lint && npm test && npm run build
(cd functions && npm run lint && npm test && npm run build)

# Deploy — order matters: Functions → Firestore → Hosting
firebase deploy --only functions --project worldcup-live-scores-2026
firebase deploy --only firestore --project worldcup-live-scores-2026
firebase deploy --only hosting --project worldcup-live-scores-2026
```

After Functions deploy, verify the health probe:

```bash
curl https://us-central1-worldcup-live-scores-2026.cloudfunctions.net/health
# → { "ok": true, "ts": "2026-..." }
```

Then hit the app:
```
https://worldcup-live-scores-2026.web.app/?season=2022
```
You should see the 2022 World Cup (a completed tournament — proves the
cache-aside + freeze rule end-to-end). Switch to `?season=2026` to see
upcoming fixtures.

---

## 7. What CI/CD does after merge into `main`

The three workflows in `.github/workflows/` orchestrate everything. You do
not run `firebase deploy` manually after this point.

### `ci.yml` — every push + PR

Runs five jobs in parallel:

1. **`web`** — `npm ci && npm run lint && npm test && npm run build` for the
   Vite client.
2. **`functions`** — same, inside `functions/`.
3. **`secret-scan`** — gitleaks. Fails the build if a UUID-shaped key or any
   default secret pattern lands in source.
4. **`plan-docs`** — on PRs, fails if any file under `src/api/**` or
   `functions/src/**` changed without a corresponding change under
   `docs/plan/**`. Keeps the spec in sync with the code.
5. **`app-check-gate`** — counts `onCall(` declarations vs `enforceAppCheck`/
   `APP_CHECK_OPTS` markers in each handler file; fails on imbalance so no
   one accidentally ships an unauthenticated callable.

All five **must pass** to merge (branch protection).

### `deploy-preview.yml` — every PR targeting `main`

Builds the client, then deploys to a Firebase Hosting **preview channel**
(`pr-<number>`, expires in 7 days). Comments the preview URL on the PR.

Cloud Functions are **not** redeployed for previews — they share the
production functions deployment. If you change Function code in a PR,
either:
- Test locally via `npm --prefix functions run serve` (emulator), or
- Spin up a separate `staging` Firebase project and add a manual workflow
  (a stub spot for this is noted in `deploy-preview.yml`).

### `deploy-prod.yml` — every push to `main`

Triggered when a PR merges into `main`. Strict ordering:

```
ci-gate → deploy-functions → deploy-firestore → deploy-hosting
```

Functions deploy first so Hosting never points at endpoints that don't
exist. Firestore rules/indexes deploy in the middle so any new rule
requirements land before clients try to read changed collections.

The service account from step 5 authenticates each deploy. Concurrency is
configured so two main-branch pushes serialize — never overlap.

---

## 8. Wire Cloud Scheduler jobs

Firebase Functions v2's `onSchedule` automatically registers the cron in
Cloud Scheduler at first deploy. Verify after step 7's first prod deploy:

```bash
gcloud scheduler jobs list --location=us-central1
```

You should see:

- `firebase-schedule-refreshLiveMatches-us-central1` — every 1 min
- `firebase-schedule-refreshFixtures-us-central1` — daily 04:00 UTC
- `firebase-schedule-refreshStandings-us-central1` — every 10 min
- `firebase-schedule-freezeCompletedSeasons-us-central1` — daily 05:00 UTC

To pause a job temporarily (e.g., during an incident):

```bash
gcloud scheduler jobs pause <job-name> --location=us-central1
```

`refreshLiveMatches` self-throttles to 5 min cadence when no LIVE matches
exist — driven by `meta/scheduler_state.live_window_active` in Firestore.

---

## 9. Monitoring + alerts

### Logs

Cloud Logging captures everything. Filter by `resource.type="cloud_function"`
and `severity>=WARNING`. Each handler emits a single `handler.complete` log
with `{ cache_hit, stale, frozen, tier_required, upstream_ms, total_ms }`.

```bash
gcloud logging read \
  'resource.type="cloud_function" AND severity>=WARNING' \
  --limit=50 --project=worldcup-live-scores-2026 --format=json
```

### Alerts

Create alert policies in Cloud Monitoring (`docs/plan/05-secrets-ops.md`
§ 8 has the canonical six policies):

| Policy                                    | Condition                                    | Action |
| ----------------------------------------- | -------------------------------------------- | ------ |
| **Functions error rate > 1 % (5 min)**    | Cloud Functions error count                  | Email  |
| **Functions p95 latency > 2 s (10 min)**  | `cloudfunctions.googleapis.com/function/execution_times` p95 | Email  |
| **Upstream 4xx (non-tier) > 5/min**       | Log-based metric on `upstream.bad_request`   | Email  |
| **Cache hit ratio < 60 % (30 min)**       | Custom metric                                | Warning |
| **Health uptime check**                   | `/health` callable returns non-200 for 60 s  | Pager  |
| **Daily Firestore reads > 90 % budget**   | Cloud Billing budget threshold               | Email  |

### Daily Firestore export (durability layer)

The freeze rule keeps data in Firestore forever, but you also want a daily
GCS snapshot in case of accidental admin-SDK writes:

```bash
gcloud firestore export gs://worldcup-live-scores-2026-backups/$(date -u +%F) \
  --collection-ids=teams,stadiums,matches,matchDetails,standings,lineups,players,rosters
```

Wire this into Cloud Scheduler with a 30-day GCS lifecycle policy on the
bucket. Full procedure in `docs/plan/05-secrets-ops.md` § 10.

---

## 10. Recurring tasks after launch

| Cadence  | Task                                                                     |
| -------- | ------------------------------------------------------------------------ |
| Per PR   | Reviewer checks the preview channel URL the bot posts.                   |
| Weekly   | Look at Dependabot PRs (`.github/dependabot.yml`); merge after CI green. |
| Monthly  | Sanity-check Cloud Billing vs. budget.                                   |
| Quarterly| Rotate `BALLDONTLIE_API_KEY` (step 2). Audit IAM bindings.               |
| Per tournament | After the World Cup concludes + 14 days, `freezeCompletedSeasons` runs automatically. Verify the freeze drill (`docs/plan/06-progress.md` M5.14). |

---

## 11. Quick reference

### Local dev loop

```bash
# Terminal 1
firebase emulators:start --only functions,firestore
# Terminal 2
npm run dev               # Vite at http://localhost:5173
```

`VITE_USE_EMULATORS=true` in `.env.local` wires the JS SDK to the emulator
suite. Without that, `npm run dev` talks to prod Functions — useful for
"works against real backend" testing.

### Seed the emulator from captured fixtures

```bash
cd functions
export FIRESTORE_EMULATOR_HOST=localhost:8080
npx tsx scripts/seed.ts
```

### Unfreeze a doc (rare operator path)

```bash
cd functions
npx tsx scripts/unfreeze.ts --doc matches/match_1000
```

### Force-deploy outside CI (emergency only)

```bash
firebase deploy --only functions --project worldcup-live-scores-2026 --force
```

Don't make this a habit — it bypasses CI gates and the App Check audit.

---

## 12. Troubleshooting first-deploy gotchas

| Symptom                                                  | Fix |
| -------------------------------------------------------- | --- |
| `Error: HTTP Error: 403, The caller does not have permission` on `firebase deploy` | Service account is missing one of the roles in step 5. Re-add. |
| Functions deploy succeeds but callables return `unauthenticated` from the browser | App Check enforcement is on, but the web app's reCAPTCHA key doesn't match. Re-check step 3b. |
| Functions deploy fails with `BALLDONTLIE_API_KEY not found` | Run step 2 again. The secret must exist before deploy, not after. |
| Scheduler jobs not appearing after first deploy          | Cloud Scheduler API not enabled — run the `gcloud services enable` block in step 1. |
| `getMatches` returns `{ data: [], tier_required: true }` | Your live key isn't GOAT-tier. Upgrade the balldontlie subscription or use `?season=2022` for free historical data. |
| Browser shows blank page in prod                         | `VITE_FIREBASE_*` env vars weren't included in the GitHub Actions build step. They must be in repo Variables/Secrets and referenced in `deploy-prod.yml`. |

---

## 13. Where everything lives

| Concern                     | File / path                                                |
| --------------------------- | ---------------------------------------------------------- |
| Project alias               | `.firebaserc`                                              |
| Hosting + Functions config  | `firebase.json`                                            |
| Firestore rules             | `firestore.rules`                                          |
| Firestore composite indexes | `firestore.indexes.json`                                   |
| Client env template         | `.env.example`                                             |
| Functions runtime config    | `functions/src/config.ts`                                  |
| Secrets binding             | `defineSecret('BALLDONTLIE_API_KEY')` in `config.ts`       |
| Cron schedules              | `functions/src/schedulers/*.ts`                            |
| CI workflows                | `.github/workflows/{ci,deploy-preview,deploy-prod}.yml`    |
| Secret-scan config          | `.gitleaks.toml`                                           |
| Operations runbook          | `docs/plan/05-secrets-ops.md` § 12                         |
| Architecture rationale      | `docs/plan/01-architecture.md`                             |
| Progress tracker            | `docs/plan/06-progress.md`                                 |

---

Good luck. The runbook in [`05-secrets-ops.md`](./plan/05-secrets-ops.md)
§ 12 is the page to bookmark for on-call.
