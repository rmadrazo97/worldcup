# functions/

Cloud Functions (TypeScript, Node 20) that proxy the balldontlie API, cache
responses in Firestore, and serve the PWA via App Check-protected callables.

## Run locally

```bash
cd functions
npm ci
npm run build
firebase emulators:start --only functions,firestore
```

Put a dev API key in `functions/.secret.local` (gitignored):

```
BALLDONTLIE_API_KEY=<your dev key>
```

See `docs/plan/05-secrets-ops.md` § 3 for the full local env wiring.

## Record new upstream fixtures

```bash
cd functions
npm run record-fixtures
```

Fixtures land under `functions/test/fixtures/upstream/`. Inspect the diff
before committing — secrets should never appear in captured responses.

## Deploy

CI handles deploys. Merges to `main` trigger
`.github/workflows/deploy-prod.yml`, which runs Functions -> Firestore rules +
indexes -> Hosting in that strict order. Do not deploy manually unless
recovering from an outage.

## Rotate the API key

Follow `docs/plan/05-secrets-ops.md` § 12 ("Incident: API key compromised").
TL;DR: `firebase functions:secrets:set BALLDONTLIE_API_KEY` then redeploy
functions; rotate upstream; destroy old secret version.

## Test the freeze rule

```bash
cd functions
npx tsx scripts/unfreeze.ts --doc matches/<id>
```

See `docs/plan/05-secrets-ops.md` § 12 ("Incident: late stat correction") for
the full procedure and the `freeze-now.ts` inverse.
