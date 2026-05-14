# 05 — Secrets, Operations, and Quality Spec

Scope: how secrets, deployments, monitoring, security rules, CI/CD, runbooks, and quality bars
work for the World Cup PWA migration from dummy data to balldontlie.io via Firebase Cloud Functions.

Project alias: `worldcup-live-scores-2026`
Target branch: `claude/plan-sports-app-api-SQMis`
Region: `us-central1` (Firestore must be created in `us-central1` or `nam5` multi-region;
if Firestore lives elsewhere, callable round-trip latency rises ~30–60 ms and egress is billed
cross-region — verify with `gcloud firestore databases describe --database='(default)'` before deploy).

Cross-references:
- `00-overview.md` — milestone exit criteria.
- `01-architecture.md` — error budgets and scheduler design.
- `03-backend-functions.md` — secret-binding code for each handler.
- `04-frontend-swap.md` — App Check client wiring.

---

## 1. Secrets inventory

| Name | Purpose | Where stored | How injected | Rotated |
|---|---|---|---|---|
| `BALLDONTLIE_API_KEY` | Upstream balldontlie auth | Firebase Secret Manager (Google Secret Manager backed) | `defineSecret('BALLDONTLIE_API_KEY')` bound to each Function that calls upstream | Every 90 days, or immediately on compromise |
| `RECAPTCHA_ENTERPRISE_SITE_KEY` | App Check provider on web — public token, safe in bundle | Vite env `VITE_RECAPTCHA_KEY` (committed to `.env.production` only if we choose; otherwise injected by CI) | Client bundle via `import.meta.env.VITE_RECAPTCHA_KEY` | Never; revocable in Google Cloud Console |
| Firebase web config (`apiKey`, `authDomain`, `projectId`, `appId`, etc.) | Client SDK init | Vite env (`VITE_FIREBASE_*`) | Client bundle | Never under normal operation; revocable by deleting the Web App in Firebase Console |
| `FIREBASE_SERVICE_ACCOUNT` | GitHub Actions deploy auth | GitHub repo Secrets | Action env var, consumed by `firebase-tools` / `FirebaseExtended/action-hosting-deploy` | Rotate the service account key in GCP IAM every 180 days |
| `GITLEAKS_LICENSE` (optional) | Pro features in gitleaks | GitHub repo Secrets | CI env var | N/A |
| `SLACK_WEBHOOK_URL` (optional, alerting) | Push monitoring alerts to Slack | GitHub repo Secrets (for CI alerts) and GCP Secret Manager (for Cloud Monitoring) | Alert policy notification channel | When channel is rotated |

Definitions:
- **Hard secret** — leakage triggers an incident: `BALLDONTLIE_API_KEY`, `FIREBASE_SERVICE_ACCOUNT`.
- **Public-by-design** — present in client bundle is fine: reCAPTCHA site key, Firebase web config.
  These are not secrets in the cryptographic sense; they're identifiers protected by App Check + rules.

---

## 2. Secret Manager setup (procedural)

Run from the repo root, with `firebase login` already done and `firebase use worldcup-live-scores-2026`.

### Create / set
```bash
# Prompts for the value — never paste the key on the command line (it lands in shell history).
firebase functions:secrets:set BALLDONTLIE_API_KEY
```

### Inspect (without printing)
```bash
firebase functions:secrets:get BALLDONTLIE_API_KEY
# Prints: name, version, createTime — never the value.
```

### Read the current value (only when troubleshooting; logs a "secret accessed" entry)
```bash
firebase functions:secrets:access BALLDONTLIE_API_KEY
```

### Destroy an old version after rotation
```bash
firebase functions:secrets:destroy BALLDONTLIE_API_KEY@1
# Use the version number from `firebase functions:secrets:get`.
```

### Bind in code

`functions/src/upstream/balldontlie.ts`:
```ts
import { defineSecret } from 'firebase-functions/params'
import { onCall, HttpsError } from 'firebase-functions/v2/https'

export const balldontlieKey = defineSecret('BALLDONTLIE_API_KEY')

export const getTeams = onCall(
  {
    region: 'us-central1',
    secrets: [balldontlieKey],
    enforceAppCheck: true,
    cors: false, // callables manage their own origins
    maxInstances: 50,
  },
  async (req) => {
    const key = balldontlieKey.value()
    // …fetch, map, cache.
  },
)
```

### Logging discipline
Never log the secret value. Add the ESLint rule below to `functions/.eslintrc.json`:

```json
{
  "rules": {
    "no-restricted-syntax": [
      "error",
      {
        "selector": "CallExpression[callee.object.name='logger'][arguments.0.value=/BALLDONTLIE_API_KEY|apiKey\\.value/]",
        "message": "Never log secret values. Use a redacted placeholder."
      }
    ]
  }
}
```

A redacted breadcrumb is fine: `logger.info('upstream call', { keyHash: hash(key).slice(0, 6) })`.

---

## 3. Local development

### `.env.local` (gitignored)
Repo root, used by Vite during `npm run dev`:
```
VITE_FIREBASE_API_KEY=AIza…
VITE_FIREBASE_AUTH_DOMAIN=worldcup-live-scores-2026.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=worldcup-live-scores-2026
VITE_FIREBASE_APP_ID=1:…:web:…
VITE_RECAPTCHA_KEY=6Lc…           # reCAPTCHA Enterprise site key, public
VITE_USE_EMULATORS=true            # toggles client to point at local callables
```

Confirm `.gitignore` contains:
```
.env
.env.local
.env.*.local
functions/.env
functions/.env.local
functions/.runtimeconfig.json
```

### Functions emulator env
`functions/.secret.local` (gitignored — recognized by the Firebase emulator for secrets):
```
BALLDONTLIE_API_KEY=<dev key, ideally a separate balldontlie account>
```

`firebase.json` snippet:
```json
{
  "emulators": {
    "auth":      { "port": 9099 },
    "functions": { "port": 5001 },
    "firestore": { "port": 8080 },
    "hosting":   { "port": 5000 },
    "ui":        { "enabled": true, "port": 4000 },
    "singleProjectMode": true
  },
  "functions": [
    {
      "source": "functions",
      "codebase": "default",
      "runtime": "nodejs20",
      "predeploy": ["npm --prefix \"$RESOURCE_DIR\" run lint", "npm --prefix \"$RESOURCE_DIR\" run build"]
    }
  ]
}
```

### Startup
```bash
# Terminal 1 — emulators
firebase emulators:start --only auth,functions,firestore,hosting

# Terminal 2 — Vite (separate so HMR is fast)
npm run dev
```

### How code reads secrets vs env
- **Secrets** (`defineSecret(...).value()`): only available inside the Function execution context.
  Reading at module top-level throws. Always read inside the handler.
- **Plain env vars** (`process.env.FOO`): available everywhere; use for non-sensitive config such as
  `UPSTREAM_BASE_URL=https://api.balldontlie.io/fifa/v1`.

---

## 4. App Check

### Provider
reCAPTCHA Enterprise (not v3 classic — Enterprise is the supported provider going forward).

### Registration
1. GCP Console → Security → reCAPTCHA Enterprise → "Create Key" → type "Website".
2. Domains: `worldcup-live-scores-2026.web.app`, `worldcup-live-scores-2026.firebaseapp.com`,
   `localhost`.
3. Copy the site key into `VITE_RECAPTCHA_KEY`.
4. Firebase Console → App Check → register the Web app → paste site key → set TTL = 1 hour.

### Client wiring
`src/api/client.js`:
```js
import { initializeApp } from 'firebase/app'
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from 'firebase/app-check'
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions'

const firebaseApp = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
})

// Debug token must be set BEFORE initializeAppCheck and only in dev.
if (import.meta.env.DEV) {
  // eslint-disable-next-line no-restricted-globals
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = true
}

initializeAppCheck(firebaseApp, {
  provider: new ReCaptchaEnterpriseProvider(import.meta.env.VITE_RECAPTCHA_KEY),
  isTokenAutoRefreshEnabled: true,
})

export const functions = getFunctions(firebaseApp, 'us-central1')
if (import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectFunctionsEmulator(functions, 'localhost', 5001)
}
```

### Server enforcement
Every callable sets `enforceAppCheck: true`. Verified in CI by:
```bash
grep -L "enforceAppCheck: true" functions/src/handlers/*.ts && exit 1 || exit 0
```
(Wired as a CI step; see § 7.)

### Debug tokens for local dev
1. Run the app in dev once; open DevTools console; copy the printed debug token.
2. Firebase Console → App Check → Apps → Web → ⋮ → "Manage debug tokens" → add it with a label like
   `local-dev-<your-name>`. TTL = 30 days.
3. The token is per-browser; re-add after clearing site data.

Never commit a debug token. Never use a debug token in CI or preview channels.

### Failure UX
- Client retries the failed callable once after waiting for `getToken({forceRefresh: true})`.
- After two failures the call surfaces as a non-blocking banner: "Verifying your device…
  retrying." The page renders cached Firestore data underneath; nothing goes hard-blank.
- If verification succeeds within 10 s, banner clears silently.
- If it fails for > 10 s, banner becomes: "We can't verify this browser. Try reloading or
  disabling extensions." with a manual retry button.

---

## 5. Firestore security rules

`firestore.rules`:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ------------------- public reads -------------------
    // World Cup scores are public information. Cached copies are not a leak.
    // The protected asset is the upstream API key, not the data.
    match /teams/{teamId}              { allow read: if true;  allow write: if false; }
    match /stadiums/{stadiumId}        { allow read: if true;  allow write: if false; }
    match /matches/{matchId}           { allow read: if true;  allow write: if false; }
    match /matchDetails/{matchId}      { allow read: if true;  allow write: if false; }
    match /standings/{seasonGroup}     { allow read: if true;  allow write: if false; }
    match /groups/{groupId}            { allow read: if true;  allow write: if false; }

    // ------------------- server-only -------------------
    match /meta/{doc}                  { allow read, write: if false; }
    match /rate_buckets/{doc}          { allow read, write: if false; }

    // ------------------- default deny -------------------
    match /{document=**}               { allow read, write: if false; }
  }
}
```

Why public reads are acceptable:
- Score data is published by FIFA, balldontlie, ESPN, BBC, etc. There is no exclusivity.
- The only asset of value in this pipeline is the `BALLDONTLIE_API_KEY`, which is never read into
  the client, never written to Firestore, and never logged.
- App Check still protects the Functions — abuse of *writes* (which only Functions can do via
  Admin SDK) is gated by App Check at the call site. Direct Firestore reads bypass App Check by
  design and that's fine because the data is public.

`firestore.indexes.json`:
```json
{
  "indexes": [
    {
      "collectionGroup": "matches",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "season",   "order": "ASCENDING" },
        { "fieldPath": "status",   "order": "ASCENDING" },
        { "fieldPath": "kickoff",  "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "matches",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "season",  "order": "ASCENDING" },
        { "fieldPath": "groupId", "order": "ASCENDING" },
        { "fieldPath": "kickoff", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "matches",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status",  "order": "ASCENDING" },
        { "fieldPath": "kickoff", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "standings",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "season",  "order": "ASCENDING" },
        { "fieldPath": "groupId", "order": "ASCENDING" },
        { "fieldPath": "rank",    "order": "ASCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

Deploy rules and indexes separately so a rules change doesn't block on index build:
```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

---

## 6. CORS

Default plan is **callable-only** (`onCall`) — these handle CORS automatically and accept only
requests from origins paired to the Firebase app via App Check.

If any `onRequest` HTTP function is added later (e.g. a webhook), it must restrict origins:

```ts
import { onRequest } from 'firebase-functions/v2/https'

const allowedOrigins = new Set([
  'https://worldcup-live-scores-2026.web.app',
  'https://worldcup-live-scores-2026.firebaseapp.com',
  'http://localhost:5173',
])

export const health = onRequest(
  { region: 'us-central1', cors: false, maxInstances: 5 },
  (req, res) => {
    const origin = req.headers.origin ?? ''
    if (allowedOrigins.has(origin)) {
      res.set('Access-Control-Allow-Origin', origin)
      res.set('Vary', 'Origin')
    }
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'GET')
      res.set('Access-Control-Max-Age', '3600')
      res.status(204).send('')
      return
    }
    res.json({ ok: true, time: Date.now() })
  },
)
```

Do **not** use `cors: true` (a wildcard) on any function in this project.

---

## 7. CI / GitHub Actions

Three workflows under `.github/workflows/`.

### 7.1 `ci.yml`
```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read
  pull-requests: write

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run lint
      - run: npm test -- --run --coverage
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: web-dist
          path: dist
          retention-days: 7

  functions:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: functions } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm', cache-dependency-path: functions/package-lock.json }
      - run: npm ci
      - run: npm run lint
      - run: npm test -- --coverage
      - run: npm run build

  secret-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GITLEAKS_ENABLE_COMMENTS: true
      - name: Grep for obvious API key shapes
        run: |
          if grep -RInE 'bdl_[A-Za-z0-9]{20,}' --exclude-dir=node_modules --exclude-dir=.git .; then
            echo "Possible balldontlie API key committed."
            exit 1
          fi

  appcheck-enforced:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Every callable must enforce App Check
        run: |
          missing=$(grep -L 'enforceAppCheck: true' functions/src/handlers/*.ts || true)
          if [ -n "$missing" ]; then
            echo "Callables missing enforceAppCheck: true:"
            echo "$missing"
            exit 1
          fi

  plan-docs:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - name: Require plan update when touching API surfaces
        run: |
          base=${{ github.event.pull_request.base.sha }}
          head=${{ github.event.pull_request.head.sha }}
          changed=$(git diff --name-only "$base" "$head")
          touches_api=$(echo "$changed" | grep -E '^(src/api/|functions/src/)' || true)
          touches_plan=$(echo "$changed" | grep -E '^docs/plan/' || true)
          if [ -n "$touches_api" ] && [ -z "$touches_plan" ]; then
            echo "Changes under src/api/ or functions/src/ must update docs/plan/."
            exit 1
          fi
```

### 7.2 `deploy-preview.yml`
```yaml
name: Deploy preview
on:
  pull_request:
    branches: [main]

permissions:
  contents: read
  pull-requests: write
  checks: write

jobs:
  preview:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }

      - name: Build web
        env:
          VITE_FIREBASE_API_KEY:     ${{ secrets.VITE_FIREBASE_API_KEY }}
          VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
          VITE_FIREBASE_PROJECT_ID:  worldcup-live-scores-2026
          VITE_FIREBASE_APP_ID:      ${{ secrets.VITE_FIREBASE_APP_ID }}
          VITE_RECAPTCHA_KEY:        ${{ secrets.VITE_RECAPTCHA_KEY }}
        run: |
          npm ci
          npm run build

      - name: Build functions
        run: |
          cd functions
          npm ci
          npm run build

      - name: Deploy Functions to preview suffix
        env:
          GOOGLE_APPLICATION_CREDENTIALS_JSON: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
        run: |
          echo "$GOOGLE_APPLICATION_CREDENTIALS_JSON" > /tmp/sa.json
          export GOOGLE_APPLICATION_CREDENTIALS=/tmp/sa.json
          npx firebase-tools deploy \
            --only functions \
            --project worldcup-live-scores-2026 \
            --force

      - name: Deploy Hosting preview channel
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          projectId: worldcup-live-scores-2026
          expires: 7d
          channelId: pr-${{ github.event.number }}
```

Note: Cloud Functions don't have a true "preview channel" mechanism. The pragmatic options:
1. Deploy functions to the same project (current PR overwrites previous PR's functions — acceptable
   for a single-maintainer repo). This is what the YAML above does.
2. Use a separate Firebase project (`worldcup-live-scores-2026-staging`) for all preview deploys.
   Recommended once there are multiple concurrent PRs.

### 7.3 `deploy-prod.yml`
```yaml
name: Deploy production
on:
  push:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: deploy-prod
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }

      - name: Install (root)
        run: npm ci

      - name: Install (functions)
        run: cd functions && npm ci

      - name: Lint + test (root)
        run: |
          npm run lint
          npm test -- --run

      - name: Lint + test (functions)
        run: |
          cd functions
          npm run lint
          npm test

      - name: Build web
        env:
          VITE_FIREBASE_API_KEY:     ${{ secrets.VITE_FIREBASE_API_KEY }}
          VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
          VITE_FIREBASE_PROJECT_ID:  worldcup-live-scores-2026
          VITE_FIREBASE_APP_ID:      ${{ secrets.VITE_FIREBASE_APP_ID }}
          VITE_RECAPTCHA_KEY:        ${{ secrets.VITE_RECAPTCHA_KEY }}
        run: npm run build

      - name: Build functions
        run: cd functions && npm run build

      # IMPORTANT: deploy functions first so the frontend never points at endpoints that don't exist.
      - name: Deploy Functions
        env:
          GOOGLE_APPLICATION_CREDENTIALS_JSON: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
        run: |
          echo "$GOOGLE_APPLICATION_CREDENTIALS_JSON" > /tmp/sa.json
          export GOOGLE_APPLICATION_CREDENTIALS=/tmp/sa.json
          npx firebase-tools deploy \
            --only functions,firestore:rules,firestore:indexes \
            --project worldcup-live-scores-2026 \
            --force

      - name: Deploy Hosting (live channel)
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          projectId: worldcup-live-scores-2026
          channelId: live
```

### Required GitHub Secrets
- `FIREBASE_SERVICE_ACCOUNT` — JSON for a service account with roles `Firebase Admin`,
  `Cloud Functions Admin`, `Service Account User`, `Secret Manager Secret Accessor`.
- `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_APP_ID`,
  `VITE_RECAPTCHA_KEY` — bundle-time public config.

Production environment in GitHub should require:
- Reviewer approval (1 reviewer) before `deploy-prod.yml` runs.
- Restrict deploys to the `main` branch.

---

## 8. Monitoring & alerting

### 8.1 Logging
- Functions use the v2 structured logger (`firebase-functions/logger`); no console.log.
- Every handler logs once on entry (`{event:'call', name, appCheckOk, uidPrefix}`) and once on exit
  (`{event:'result', name, ms, cache:'hit'|'miss'|'bypass', upstreamMs?}`).
- Errors log with `severity: 'ERROR'` and `serviceContext: {service: name}`; this auto-routes to
  Error Reporting.

### 8.2 Error Reporting
Auto-enabled for Functions. Group + assign on first occurrence; do not mute.

### 8.3 Cloud Monitoring alerts

Provision via `terraform/monitoring.tf` (or one-time gcloud commands; track in this repo under
`ops/monitoring/`). Channels: `email-oncall`, `slack-worldcup`.

| Alert | Metric | Condition | Channel |
|---|---|---|---|
| Functions error rate | `cloudfunctions.googleapis.com/function/execution_count` filtered by `status!="ok"` | > 1% of total over 5 min | email + Slack |
| Functions p95 latency | `cloudfunctions.googleapis.com/function/execution_times` | p95 > 2000 ms over 10 min | email |
| Upstream 4xx (non-paywall) | log-based metric `upstream_4xx_other` (excludes `tier_required`) | > 5/min for 5 min | email |
| Cache hit ratio | log-based metric `cache_hit` / (`cache_hit` + `cache_miss`) | < 60% over 30 min | warn-only (Slack) |
| Uptime check failure | `monitoring.googleapis.com/uptime_check/check_passed` on `/health` | any failure | email + Slack |
| Secret access spike | Audit log filter on `BALLDONTLIE_API_KEY` `AccessSecretVersion` | > 100/min | email (potential abuse) |

### 8.4 Uptime check
- HTTP function `health` (see § 6) returns `{ok:true}`.
- GCP Monitoring uptime check pings it every 60 s from 3 regions.
- Alert on 2 consecutive failures.

---

## 9. Cost guardrails

- `maxInstances: 50` on every Function. The single-keyholder upstream tier can't sustain more
  anyway; this also caps egress.
- Firestore budget alert at $25/month (default) with notifications at 50% / 90% / 100%. Raise to
  $100 if traffic during tournament weeks exceeds the soft cap; document changes in PR.
- Scheduler back-off: `refreshLiveMatches` drops from 30 s to 5 min when no `LIVE` matches exist —
  see `01-architecture.md` § "Scheduler design".
- No `quotaUser` today (no per-user metering), but reserve the hook in
  `functions/src/middleware/quota.ts` for the future.
- Budget setup:
  ```bash
  gcloud billing budgets create \
    --billing-account=<BILLING_ACCOUNT_ID> \
    --display-name="worldcup monthly" \
    --budget-amount=25USD \
    --threshold-rule=percent=0.5 \
    --threshold-rule=percent=0.9 \
    --threshold-rule=percent=1.0 \
    --filter-projects=projects/worldcup-live-scores-2026
  ```

---

## 10. Backup & recovery

### Firestore export
Scheduled function (or Cloud Scheduler job) runs daily at 04:00 UTC:
```bash
gcloud firestore export gs://worldcup-live-scores-2026-backups/$(date -u +%Y-%m-%d) \
  --project=worldcup-live-scores-2026
```

GCS lifecycle on bucket `worldcup-live-scores-2026-backups`:
- Standard storage for 30 days.
- Delete after 30 days.

Bucket creation:
```bash
gcloud storage buckets create gs://worldcup-live-scores-2026-backups \
  --location=us-central1 \
  --uniform-bucket-level-access \
  --project=worldcup-live-scores-2026
gcloud storage buckets update gs://worldcup-live-scores-2026-backups \
  --lifecycle-file=ops/gcs-lifecycle.json
```

### Functions
Versioned in git. To roll back: `git revert <sha> && git push origin main`. CI redeploys.

### Restore drill (one paragraph)
1. Identify the bad write window from Cloud Logging.
2. Pick the most recent good export under `gs://worldcup-live-scores-2026-backups/`.
3. Create a sibling Firestore database (`scratch-restore`), import the export, diff against live,
   and copy the corrected docs back via a one-off script
   (`functions/scripts/restore-from-export.ts`). Do **not** import directly over the live database
   — that erases newer good writes that arrived after the bad window.
4. Verify in the PWA. Write a postmortem in `docs/postmortems/`.

---

## 11. Quality bars

### Lint
- Root: existing ESLint flat config (`eslint.config.js`) covers JS + JSX.
- Functions: `functions/.eslintrc.json` with `@typescript-eslint/recommended` plus the
  no-restricted-syntax rule from § 2.
- `npm run lint` fails CI on any error; warnings allowed but reported.

### Type-check
- Functions: `tsc --noEmit` with `"strict": true`, `"noUncheckedIndexedAccess": true`,
  `"exactOptionalPropertyTypes": true`.
- Client: stays JS. Shared shapes (e.g. `Match`, `Team`) are declared as JSDoc typedefs in
  `src/api/types.js` so IDE autocompletion and inference still work.

### Test coverage
- Mappers (`functions/src/mappers/*`): **≥ 80% lines and branches**. Enforced by
  `vitest --coverage --coverage.thresholds.lines=80 --coverage.thresholds.branches=80`.
- Every handler has at least one integration test that runs against the Firestore emulator with a
  mocked upstream fetcher.
- Every page component (`src/components/*Page.jsx`) has at least one render-and-assert test using
  Vitest + Testing Library.

### Lighthouse
- CI runs `@lhci/cli` against the deployed preview channel on PRs.
- PWA score ≥ 95. Performance ≥ 90. Accessibility ≥ 95. Best Practices ≥ 95.
- Failure blocks merge.

### Accessibility
- `axe-core` runs in component tests against `/`, `/standings`, `/teams`, `/matches/:id`.
- Fail on `impact: 'serious'` or `'critical'`. Allow `'moderate'` with a TODO link.

### Bundle size budget
- Initial JS: **≤ 200 KB gzipped** (current build ~85 KB; budget gives headroom).
- Enforced by `vite-bundle-visualizer` + a CI step that parses the manifest:
  ```bash
  node scripts/check-bundle-size.js --limit=200
  ```

---

## 12. Runbook

Use this verbatim during an incident. Page the on-call rotation if MTTR > 15 min.

### Incident: live scores stuck (UI shows stale matches during a live window)
1. Open Cloud Logging, filter:
   `resource.type="cloud_function" AND resource.labels.function_name="refreshLiveMatches"`
   for the last 10 min.
2. If you see HTTP 429s from upstream:
   - `gcloud firestore documents describe meta/upstream_budget`
   - If `remaining < 10`, the scheduler is hot. Manually relax:
     `firebase functions:config:set scheduler.live_interval_seconds=120` and redeploy
     `refreshLiveMatches`.
3. If you see Firestore write errors:
   - Check IAM: the Functions service account must have `Cloud Datastore User`.
   - Check Firestore region matches Functions region.
4. Manual fallback — invoke the scheduler synchronously:
   ```bash
   gcloud functions call refreshLiveMatches --region=us-central1
   ```
5. If upstream is truly down, set the feature flag `meta/flags/forceCacheOnly = true`. UI shows
   "Scores delayed — upstream provider degraded" banner; reads continue from Firestore.

### Incident: API key compromised
1. **Rotate immediately:**
   ```bash
   firebase functions:secrets:set BALLDONTLIE_API_KEY
   # paste new key value at prompt
   firebase deploy --only functions --project worldcup-live-scores-2026
   ```
   (Functions pick up the new secret version on next deploy; existing instances keep the old
   version until they scale down. The redeploy forces fresh instances.)
2. Rotate the key in the balldontlie dashboard so the old version is revoked upstream.
3. Audit recent logs for the leaked value:
   ```
   resource.type="cloud_function"
   textPayload:("bdl_" OR "BALLDONTLIE_API_KEY")
   ```
   Expected: zero hits. If any, file a security incident; secret was logged in error.
4. Destroy old secret version: `firebase functions:secrets:destroy BALLDONTLIE_API_KEY@<old>`.
5. Update the rotation record in `docs/security/rotations.log`.

### Incident: tier downgrade (paid features stop working)
1. Verify by examining the upstream response: a `403` with body containing `tier_required` from
   balldontlie.
2. UI already handles this: detailed stats pages surface "Detailed stats require a paid
   subscription" — that is intentional, no code change needed.
3. Renew the balldontlie plan. No deploy needed; cache will fill on next scheduled refresh.

### Incident: PWA offline regression (offline shell broken)
1. Verify the Workbox-generated precache manifest exists in `dist/sw.js` and lists the app shell:
   `grep precacheAndRoute dist/sw.js`
2. In Chrome: `chrome://serviceworker-internals` → find scope `worldcup-live-scores-2026.web.app`
   → check "Status" is `ACTIVATED and is RUNNING`.
3. Force a clean reinstall: DevTools → Application → Service Workers → Unregister → reload.
4. If still broken, roll back the previous deploy: `git revert <sha> && git push`.

### Incident: schema drift (upstream changed a field)
1. The mapper fixture tests gate every deploy. If a deploy made it through and the drift wasn't
   caught, the test fixture is stale.
2. Flip the feature flag for the affected surface:
   `meta/flags/<feature>.enabled = false`. UI falls back to last-known-good Firestore doc.
3. Update the mapper, update the fixture (`functions/src/mappers/__fixtures__/`), redeploy.
4. Re-enable the flag.

### Incident: App Check storm (many `unauthenticated` errors after a deploy)
1. Check that `enforceAppCheck: true` is on the function — the CI gate should have caught
   removal, but verify.
2. Check the reCAPTCHA Enterprise key isn't suspended (Console → Security → reCAPTCHA Enterprise).
3. If a legitimate domain change rolled out, ensure it's in the App Check allowlist.
4. Temporarily widen App Check TTL to 4 h while diagnosing:
   Firebase Console → App Check → Web → TTL. Revert after.

### Incident: late stat correction needs to land in a frozen season

Background: `freezeCompletedSeasons` (see `03-backend-functions.md` § 8.4) pins all docs for a
finished tournament with `_frozen: true`. Cache reads short-circuit upstream when `_frozen`. This
gives us the "data lives on our side forever" guarantee but blocks corrections.

1. Identify the doc(s) affected (e.g. `matches/1000`, `matchDetails/1000/events`).
2. From a workstation with `firebase` CLI + appropriate IAM:
   ```bash
   cd functions
   npx tsx scripts/unfreeze.ts --doc matches/1000 --doc matchDetails/1000/events
   ```
   The script clears `_frozen` and resets `_expiresAt` to a near-term TTL on the listed docs.
3. The next read fetches from upstream and writes through normally. Verify in Firestore that the
   payload reflects the correction.
4. The next nightly `freezeCompletedSeasons` pass re-freezes the doc. If you need it to stay
   un-frozen long-term (rare — e.g. an actively-corrected match), set
   `meta/freezeOverride/{docPath} = { frozen_disabled: true }`. Document the override in this
   runbook with a reason.

Never delete a frozen doc to "force a refresh" — you'll lose the cached payload if upstream is
unreachable. Always go through `unfreeze.ts`.

### Incident: upstream balldontlie API permanently offline

If balldontlie shuts down or revokes our access for a non-recoverable reason, the freeze rule
keeps every completed season fully readable from Firestore. Steps:

1. Confirm scope: which seasons are affected? `gcloud firestore export` and inspect.
2. Suspend the schedulers to stop the 401-spam in logs:
   ```bash
   gcloud scheduler jobs pause refreshLiveMatches --location=us-central1
   gcloud scheduler jobs pause refreshFixtures --location=us-central1
   gcloud scheduler jobs pause refreshStandings --location=us-central1
   # keep freezeCompletedSeasons running — it operates only on cached docs.
   ```
3. Set `meta/upstream.disabled: true`. Cache layer reads this and skips upstream calls entirely,
   returning whatever is in Firestore (even past `_expiresAt`).
4. If 2026 is in-progress at the time, mark its current state frozen via the unfreeze override
   inverse: `npx tsx scripts/freeze-now.ts --season 2026 --reason manual`.
5. Surface a "data archive — tournament concluded" banner in the UI (feature flag in
   `meta/uiFlags.archive_mode`).

---

## 13. Privacy & compliance

- **No PII.** The app collects no name, email, address, location.
- **Auth:** Anonymous Firebase Auth only. UIDs are random and not linked to a person. Used solely
  to satisfy any future per-user rate limiting.
- **App Check tokens:** device-bound (per browser), not user-identifying, expire hourly.
- **Cookies:** only the Firebase session cookie required for App Check. Strictly functional;
  GDPR/CCPA recital allows this without consent UI. If analytics are added later (Plausible, GA4,
  etc.), a consent banner becomes mandatory in EU/UK regions — that is **not** in scope here.
- **Data retention:** Firestore caches are overwritten on each refresh; backups expire at 30 days
  (see § 10). No personally retained data.
- **Subprocessors:** Google Cloud (Firebase + Firestore + Functions + Secret Manager),
  balldontlie.io. Document in `docs/privacy/subprocessors.md` if a privacy page is ever added.

---

## 14. Release process

- **Trunk-based.** `claude/plan-sports-app-api-SQMis` is the active dev branch.
- PRs target `main`. CI must be green; at least one human review.
- Merging to `main` triggers `deploy-prod.yml`:
  1. Functions deploy.
  2. Firestore rules + indexes deploy.
  3. Hosting deploys.
- Tag releases as `v0.x.y` on the merge commit. Each milestone in `00-overview.md` gets a tag.
- Hotfix: branch from `main`, fix, PR, merge — same path. No separate hotfix flow.
- Rollback: `git revert` on `main` (preferred), or `firebase hosting:rollback` for the web layer
  only.

---

## 15. Cross-references

- `00-overview.md` — milestone exit criteria; each milestone's "Done" gate references the alerts,
  coverage thresholds, and Lighthouse score from this doc.
- `01-architecture.md` — error budgets and scheduler back-off rules; the alerts in § 8 are sized
  to those budgets.
- `03-backend-functions.md` — concrete secret-binding code for each handler; matches the pattern
  in § 2.
- `04-frontend-swap.md` — App Check client wiring; uses the snippet in § 4.

---

## Appendix A — One-time bootstrap checklist

Run once when first standing up the project:

- [ ] `firebase use --add worldcup-live-scores-2026` (alias = default)
- [ ] `firebase functions:secrets:set BALLDONTLIE_API_KEY`
- [ ] Create reCAPTCHA Enterprise site key; paste into Firebase Console App Check
- [ ] Create GCP service account `gh-deploy@worldcup-live-scores-2026.iam.gserviceaccount.com`
      with `Firebase Admin`, `Cloud Functions Admin`, `Service Account User`,
      `Secret Manager Secret Accessor`
- [ ] Add `FIREBASE_SERVICE_ACCOUNT` and the `VITE_*` secrets to GitHub repo Secrets
- [ ] Create `gs://worldcup-live-scores-2026-backups` GCS bucket with 30-day lifecycle
- [ ] Set monthly budget alert at $25
- [ ] Configure Monitoring notification channels: `email-oncall`, `slack-worldcup`
- [ ] Create alert policies from § 8.3
- [ ] Add uptime check on `/health`
- [ ] Verify Firestore region matches `us-central1` (or document the divergence)
- [ ] Confirm `.gitignore` includes `.env.local`, `functions/.secret.local`,
      `functions/.runtimeconfig.json`
- [ ] Tag baseline release `v0.1.0`

## Appendix B — Quick reference

| Action | Command |
|---|---|
| Set secret | `firebase functions:secrets:set BALLDONTLIE_API_KEY` |
| Access secret value | `firebase functions:secrets:access BALLDONTLIE_API_KEY` |
| List secret versions | `firebase functions:secrets:get BALLDONTLIE_API_KEY` |
| Destroy old version | `firebase functions:secrets:destroy BALLDONTLIE_API_KEY@N` |
| Deploy functions only | `firebase deploy --only functions` |
| Deploy rules only | `firebase deploy --only firestore:rules` |
| Deploy indexes only | `firebase deploy --only firestore:indexes` |
| Manually invoke scheduler | `gcloud functions call refreshLiveMatches --region=us-central1` |
| Hosting rollback | `firebase hosting:rollback` |
| Local emulators | `firebase emulators:start --only auth,functions,firestore,hosting` |
| Firestore export | `gcloud firestore export gs://worldcup-live-scores-2026-backups/$(date -u +%F)` |
