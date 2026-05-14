# World Cup 2026 — Live Scores PWA

An installable, offline-capable Progressive Web App for following the 2026 FIFA World Cup: live scores, group standings, fixtures, and a per-match view with formation lineups, statistics, and an event timeline.

The data layer is currently mock-backed. The async API surface (`src/api/scores.js`) is the swap point — replace its bodies with `fetch()` calls and components stay untouched.

---

## Stack

- **Build:** Vite 5
- **UI:** React 18 + React Router 6 (functional components, hooks)
- **PWA:** vite-plugin-pwa (Workbox service worker, web manifest, flagcdn.com runtime cache)
- **Styling:** vanilla CSS in a single file (`src/styles.css`) — no Tailwind, no CSS modules
- **Quality:** ESLint flat config + Vitest (jsdom + Testing Library)
- **Hosting:** Firebase Hosting (configured but optional)

No TypeScript. No state-management library. No icon library — SVG is inlined where used.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
```

Other scripts:

```bash
npm run build        # production build → dist/
npm run preview      # serve dist/ → http://localhost:4173
npm run lint         # ESLint
npm run test         # Vitest (one-shot)
npm run test:watch   # Vitest watch mode
```

---

## Routes

| Path | Page | Purpose |
|---|---|---|
| `/` | `src/pages/MainFeed.jsx` | Date strip, live now, today's matches, group grid |
| `/group/:groupId` | `src/pages/GroupDetailPage.jsx` | Standings table + per-matchday fixture lists for `A`…`L` |
| `/match/:matchId` | `src/pages/MatchDetailPage.jsx` | Summary card, three tabs: Line up (SVG pitch), Statistics, Timeline |
| `*` | — | Redirects to `/` |

Unknown `groupId` or `matchId` falls through to an in-page "not found" view with a link back home (not a redirect).

---

## Project structure

```
.
├── design/                 # Original HTML/React prototype kept as visual reference
├── public/
│   ├── favicon.svg
│   └── fonts/              # Geist + Geist Mono (self-hosted, precached by SW)
├── src/
│   ├── api/
│   │   ├── clock.js        # Single source of "now" — swap to real Date when live
│   │   ├── mock-data.js    # TEAMS, GROUPS, VENUES, MATCHES, FORMATIONS, LINEUPS, MATCH_DETAILS
│   │   └── scores.js       # Async API surface — the data layer seam
│   ├── components/         # Header, Intro, DateStrip, Tabs, cards, MatchDetail subviews
│   ├── pages/              # MainFeed, GroupDetailPage, MatchDetailPage
│   ├── App.jsx             # <Routes>
│   ├── main.jsx            # createRoot + BrowserRouter + registerSW
│   ├── styles.css          # All CSS (~1800 lines)
│   └── test-setup.js       # Vitest setup (jsdom shims)
├── index.html
├── vite.config.js          # Vite + VitePWA + Vitest config
├── eslint.config.js        # Flat config, React + hooks rules
├── firebase.json
└── package.json
```

---

## Architecture — for AI coding agents

This section is a contract. Follow these conventions when extending the app; agents that drift from them tend to make changes that compile but regress design or accessibility.

### Data flow

```
Components ──▶ src/api/scores.js (async)
                 │
                 ▼
              src/api/mock-data.js (today)
              fetch('/api/...') (future)
```

- **Components never import `mock-data.js` directly.** They call functions from `scores.js`. The mappers and the seam to a real API will be added inside `scores.js` only.
- Exceptions that import `mock-data.js` today: `MainFeed.jsx` (for the in-memory `computeStandings` helper), and the new match-detail components (`LineupView`, `StatsView`, `TimelineView`) which look up `LINEUPS` / `MATCH_DETAILS` / `TEAMS` synchronously. When a real API lands, these get pushed behind `scores.js` too.
- Every page-level component goes through this state shape when fetching:

```jsx
const [data, setData] = useState(null)
const [loading, setLoading] = useState(true)
const [error, setError] = useState(null)
const [notFound, setNotFound] = useState(false)   // when looking up a single resource by id
const [reloadKey, setReloadKey] = useState(0)     // increment to retry
```

`src/components/GroupDetail.jsx` is the canonical example. Mirror it.

### "Now" is a single source

Today is **not** `new Date()`. It's `getNow()` from `src/api/clock.js`, which returns a frozen instant matching the mock fixtures (June 19, 2026, 4:31 PM local). All date math derives from it:

- `formatShortDate(date)` → `"Jun 19"` (matches the keys in `MATCHES[].date`)
- `formatLongEyebrow(date)` → `"Friday, June 19"`
- `isSameLocalDay(a, b)`

When live data lands, swap the body of `getNow()` to `() => new Date()` — and only then. **Never hardcode `"Jun 19"` or `"Friday, June 19"` in components.**

### Routing & navigation

- Pages are owned by files in `src/pages/`. They render a `<Header />`, the page content, and a `<Footer />` (duplicated across pages — fine for now).
- Cards (`MatchCard`, `LiveCard`, `GroupCard`) are `<Link>`s, not clickable divs. Keyboard activation + focus rings come for free.
- Back navigation uses `useNavigate()(-1)` inside the page wrappers — never on inner components.

### Styling

- Single `src/styles.css` (~1800 lines), organized by section with the `═══ Section ═══` divider comments. Append new sections at the bottom.
- All colors use CSS variables defined in `:root` (`--cobalt`, `--periwinkle`, `--ink-0`…`--ink-4`, `--live`, …). **Don't introduce raw hex values in component styles.**
- Don't add `inline style={{ ... }}` for layout. Inline is OK for one-off values (focus outlines, dynamic widths in stat bars).
- Card-as-link reset is already in `styles.css` — selectors `a.match-card`, `a.live-card`, `a.group-card`.

### Components are pure-presentational where possible

`MatchCard`, `LiveCard`, `GroupCard`, `Intro`, `DateStrip`, `Tabs`, `LineupView`, `StatsView`, `TimelineView`, `FanRush`, `Pitch` all accept their data via props and don't fetch. Containers (`MainFeed`, `GroupDetail`, `MatchDetail`) own the loading/error state machine and pass data down.

### Testing

- Tests live next to source: `src/api/clock.test.js`, `src/api/mock-data.test.js`, `src/App.test.jsx`.
- Use `@testing-library/react` + `MemoryRouter`. Render the whole `<App />` for route tests.
- `Element.prototype.scrollIntoView` is shimmed in `src/test-setup.js` — jsdom doesn't implement it but `DateStrip` calls it on mount.
- Run `npm run test` before declaring a feature done.

### Conventions

- **No semicolons.** All new files match the existing style: 2-space indent, single quotes, no trailing semicolons.
- **No `React.Fragment` imports.** Use `<>…</>`.
- **No prop-types.** Plain JS only.
- **No `// removed`/`// TODO` comments for code that's gone.** Just delete it.
- **No new dependencies without a stated reason.** Check `package.json` first.

---

## Extending the app

### Add a new tab inside the match detail view

1. Add a new tab key to the `useState('lineup')` initializer in `src/components/MatchDetail.jsx`.
2. Add a `<button className={"detail-tab" + (tab === "yourtab" ? " active" : "")} …>` to the `.detail-tabs` row.
3. Add a `{tab === "yourtab" && <YourView match={match} />}` branch.
4. Create `src/components/YourView.jsx` — default-export a component that takes `{ match }`. If it needs data, render a `.detail-fallback` block when the data is missing (mirror `StatsView`).

### Wire a real data source

1. Open `src/api/scores.js`. Each exported async function is a single seam — replace `delay()` + `clone()` of mock data with `fetch(\`\${BASE}/your/path\`).then(r => r.json())`.
2. Update the shape via mappers (add `src/api/mappers.js` if useful) — components expect the existing internal shape.
3. Update `src/api/clock.js`'s `getNow()` to return `new Date()`.
4. Add a Vite env var for the base URL in `.env.local` (gitignored). Reference it via `import.meta.env.VITE_API_BASE_URL`.

### Add a new route

1. Create `src/pages/YourPage.jsx`. Wrap content in `<div className="app">` and include `<Header view="detail" onBack={() => navigate(-1)} … />` plus `<Footer />` (copy from `GroupDetailPage.jsx`).
2. Register the route in `src/App.jsx`.
3. Add at least one test in `src/App.test.jsx` rendering `<MemoryRouter initialEntries={['/your/path']}>`.

---

## Service worker behavior

- `registerType: 'autoUpdate'` — new SW activates on next navigation, no toast.
- Precaches all build output (JS, CSS, HTML, fonts, SVG, manifest).
- Runtime cache for `flagcdn.com` images: `CacheFirst`, 30-day max age, 100-entry cap.
- The app shell + the last viewed group/match render offline once visited.

To test offline behavior: DevTools → Application → Service Workers → "Offline" → reload.

---

## What's intentional that might look strange

- **"Today" is frozen.** The app is built against fixed mock data keyed to June 19, 2026. `getNow()` returns that instant. This is by design until a live data source is wired.
- **The `design/` folder is a reference, not a build input.** Original HTML/React prototype + screenshots. Useful to compare against when porting new views. Don't delete it; don't import from it.
- **Cards are anchors, not buttons.** They navigate; `<Link>` is correct semantics.
- **Two GitHub-style `<>` fragments inside SVG.** `Pitch.jsx` uses SVG `<g>` containers — not JSX fragments.
- **Footer duplicated across page wrappers.** Three identical `<Footer />` functions exist. Leave them duplicated until a real layout component is needed.

---

## Deployment

Firebase Hosting is wired but not required.

```bash
npm run build
npm run deploy:preview      # ephemeral preview channel
npm run deploy:prod         # production
```

You'll need `firebase login` and the project alias set in `.firebaserc`.

---

## License

Not affiliated with FIFA. Mock data is for demonstration only.
