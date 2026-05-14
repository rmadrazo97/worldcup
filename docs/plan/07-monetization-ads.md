# Monetization — Google AdSense + Consent Mode v2

**Status:** active · **Owner:** team · **Last updated:** 2026-05-14

Covers the client-side ad surface and the consent plumbing it depends on.
This was a non-goal in the original plan (see `00-overview.md` §1) and is
captured here as the first revenue-oriented workstream now that the data
pipeline is production-ready.

---

## 1. Goals

| # | Goal | Done when… |
|---|---|---|
| M1 | Ship a configurable ad surface that's safe to deploy before AdSense approval | With no `VITE_ADSENSE_CLIENT_ID`, `<AdSlot/>` renders nothing and the loader is a no-op. |
| M2 | Be legally defensible globally on day one | Privacy Policy reachable from every page; Google Consent Mode v2 defaults to `denied` for ad + analytics signals; user choice persists. |
| M3 | Never degrade the live-match experience | LIVE / HT match views suppress the in-page ad. No layout shift on configured slots; no space reserved on unconfigured ones. |
| M4 | Operable without a deploy if something breaks | A single env flag (`VITE_ADS_ENABLED=false`) disables ad loading globally. |

Non-goals: server-side ad insertion, header bidding, anchor / interstitial
units, removing ads for paying users (no paid tier yet), TCF-certified CMP
(delegated to Google's free CMP enabled in the AdSense console).

---

## 2. Module surface

| Module | Responsibility |
|---|---|
| `src/api/ads.js` | Env-driven config (`adsConfig`), `adsReady()` gate, idempotent `loadAdsScript()` that injects `pagead2.googlesyndication.com/.../adsbygoogle.js?client=…` once. |
| `src/api/consent.js` | Reads / writes user choice to `localStorage` (`wc26.consent.v1`), applies it via `gtag('consent','update',…)`, exposes a `wc26:open-consent` custom event for re-opening the banner. |
| `src/components/AdSlot.jsx` | Renders one `<ins class="adsbygoogle">` with `data-ad-client` / `data-ad-slot` / `data-ad-format="auto"` / `data-full-width-responsive`. Calls `window.adsbygoogle.push({})` once per mount. Returns `null` when the gate is off — no reserved height. |
| `src/components/ConsentBanner.jsx` | Mounts globally from `App.jsx`. Visible until choice is persisted; reopenable via the footer button or `openConsentBanner()`. Accept/Reject set all four Consent Mode v2 signals together. |
| `src/pages/PrivacyPage.jsx` | `/privacy` route. Covers identity, data collected, cookies, AdSense, third parties (Firebase, balldontlie, flagcdn, reCAPTCHA), GDPR/UK GDPR/CCPA rights, retention, children, transfers, change history. |
| `index.html` | Inline `<script>` sets Consent Mode v2 defaults to `denied` and `wait_for_update: 500` **before** any analytics / ad code runs. |
| `src/main.jsx` | Calls `loadAdsScript()` at boot (no-op when disabled). |

### Placement contract (moderate density)

| Page | Slot ID env var | Positions |
|---|---|---|
| `/` (MainFeed) | `VITE_ADSENSE_SLOT_HOME` | Between LIVE rail and the day's match list; above the groups grid. |
| `/group/:groupId` (GroupDetail) | `VITE_ADSENSE_SLOT_GROUP` | Below standings; at page bottom. |
| `/match/:matchId` (MatchDetail) | `VITE_ADSENSE_SLOT_MATCH` | Between summary card and tabs (suppressed when `status === 'LIVE'` or `'HT'`); below tabs. |

A single slot ID is reused for the two placements on each page in the
initial drop. Splitting into top/bottom IDs is tracked as a follow-up once
fill data is available — better reporting granularity, no code change
beyond more env vars.

---

## 3. Configuration

All values flow through Vite's `import.meta.env`. The build artifact is
identical across environments; production sets the IDs.

```
VITE_ADS_ENABLED=true                # master kill switch
VITE_ADSENSE_CLIENT_ID=              # ca-pub-XXXXXXXXXXXXXXXX after approval
VITE_ADSENSE_SLOT_HOME=              # 10-digit numeric slot ID
VITE_ADSENSE_SLOT_GROUP=
VITE_ADSENSE_SLOT_MATCH=
```

Every var is public (`VITE_` prefix) — these are not secrets; the slot
IDs are visible in the rendered `<ins>` attributes. Setting any one
slot ID to empty disables just that placement.

### Kill switch

Set `VITE_ADS_ENABLED=false` at build time (or as a GitHub Actions secret
override) to disable ad loading entirely without removing slot IDs.
`<AdSlot/>` returns `null` and `loadAdsScript()` becomes a no-op. Use
this if AdSense misbehaves during a live match.

---

## 4. Consent model

Google Consent Mode v2 is the wire protocol; the in-app banner is the
UI. The flow:

1. **Boot (`index.html` inline script):**
   `gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied', wait_for_update: 500 })`.
   Set before any other script — ensures both Firebase Analytics (loaded
   via `getAnalytics()` in `src/api/client.js`) and AdSense respect the
   default deny.
2. **First mount (`ConsentBanner.jsx`):** reads `localStorage.wc26.consent.v1`.
   If present, calls `applyConsent(stored)` which issues a `gtag('consent','update',…)`.
   If absent, shows the banner.
3. **User chooses:** Accept ⇒ all four signals become `granted`; Reject ⇒
   all stay `denied`. Choice persists with a `ts` for future "re-prompt
   after N months" policy work (not implemented yet).
4. **Re-open:** Footer "Cookie settings" button dispatches the
   `wc26:open-consent` custom event; banner re-mounts.

In regions where Google requires a TCF-certified CMP (EEA, UK, parts of
CA), enable Google's free CMP in **AdSense → Privacy & messaging**.
Our banner handles defaults / persistence; Google's CMP layers the
TCF-certified vendor list on top automatically once the AdSense tag is
on the page. The two co-exist by design — Consent Mode v2 is the shared
protocol.

---

## 5. Risk register

| Risk | Mitigation |
|---|---|
| Ad code breaks during a live match | Kill switch (`VITE_ADS_ENABLED=false`) takes effect on next deploy; AdSense `<ins>` already suppressed on LIVE / HT match detail. |
| Layout shift hurts Core Web Vitals | `min-height: 90px` on `.adsbygoogle` reserves space *only* when an ad will load; unconfigured slots render `null`. |
| Service worker caches AdSense scripts | Workbox `globPatterns` matches local assets only; AdSense domains are cross-origin and not intercepted. Verified in `vite.config.js`. |
| CSP added later blocks AdSense | When CSP work begins, allow `pagead2.googlesyndication.com`, `googleads.g.doubleclick.net`, `*.googlesyndication.com`, `*.google.com`. Inline Consent Mode defaults require `'unsafe-inline'` or a script hash. |
| Slot reused for two placements rejected by AdSense | AdSense permits this since 2019, but reporting is coarser. Tracked follow-up: split into top/bottom slot IDs. |
| User in a strict consent jurisdiction sees ads before consent | Defaults are `denied`; AdSense renders only non-personalized ads when `ad_storage='denied'` in regions where allowed, none otherwise. Google CMP (recommended) layers TCF on top. |

---

## 6. Open follow-ups

- [ ] Split `SLOT_{HOME,GROUP,MATCH}` into `SLOT_{…}_TOP` / `…_BOTTOM` after first month of fill data.
- [ ] Enable Google's IAB TCF v2.2 CMP in AdSense console (operational, not code).
- [ ] `useNavigate(-1)`-with-fallback for back button on `/privacy` (and the other detail pages — pre-existing issue).
- [ ] Once a paid tier exists, add `userHasPass` short-circuit to `adsReady()`.
- [ ] CSP rollout: document required AdSense origins.
- [ ] Happy-path test for `AdSlot` (stub `window.adsbygoogle`, assert push).

---

## 7. Cross-references

- Privacy policy text: `src/pages/PrivacyPage.jsx`
- Footer "Cookie settings" button: `src/components/Footer.jsx`
- Existing analytics surface this layers onto: `src/api/analytics.js` + `src/api/client.js`
