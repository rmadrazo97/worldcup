import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'

// Mock the Firebase + data layer so tests don't touch the network.
vi.mock('./api/client.js', () => ({
  initClient: () => ({ app: null, auth: null, functions: null, db: null, appCheck: null }),
  getClient: () => ({ app: null, auth: null, functions: null, db: null, appCheck: null }),
  callable: () => () => Promise.resolve({ data: { data: [] } }),
  unwrapCallable: () => Promise.resolve({ data: [] }),
  onAuthReady: () => Promise.resolve(null),
}))

const mockTeams = [
  { id: 9, short: 'BRA', name: 'Brazil', code: 'br', confederation: 'CONMEBOL' },
  { id: 21, short: 'NED', name: 'Netherlands', code: 'nl', confederation: 'UEFA' },
]
const mockGroups = [
  { id: 'A', host: null, teams: ['NED'] },
]
const mockMatches = [
  {
    id: '1000', season: 2026, stage: 'group', stage_label: 'Group A · MD 1',
    group: 'A', md: 1, home: 'BRA', away: 'NED', homeId: 9, awayId: 21,
    hs: null, as: null, pens: null, status: 'SCHED', minute: null,
    kickoff_iso: '2026-06-12T19:00:00.000Z',
    venueId: null, venueShort: null, home_formation: null, away_formation: null,
    referee: null, attendance: null,
  },
]
const mockMatchDetails = {
  matchId: '1000', lineups: { home: null, away: null }, events: [],
  stats: null, attendance: null,
}

vi.mock('./api/scores.js', () => ({
  getTeams: vi.fn(async () => mockTeams),
  getStadiums: vi.fn(async () => []),
  getVenues: vi.fn(async () => ({})),
  getGroups: vi.fn(async () => mockGroups),
  getStandings: vi.fn(async () => []),
  getMatches: vi.fn(async () => mockMatches),
  getMatchById: vi.fn(async (id) => (id === '1000' ? mockMatches[0] : null)),
  getMatchDetails: vi.fn(async (id) => (id === '1000' ? mockMatchDetails : null)),
  getLineup: vi.fn(async () => null),
  getFormation: vi.fn(() => []),
}))

vi.mock('./api/live.js', () => ({
  subscribeMatch: () => () => {},
  subscribeMatchDetails: () => () => {},
}))

// Imported AFTER mocks so they pick them up.
const App = (await import('./App.jsx')).default
const { SeasonProvider, TeamsProvider } = await import('./api/providers.jsx')

function renderApp(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SeasonProvider>
        <TeamsProvider>
          <App />
        </TeamsProvider>
      </SeasonProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('App routing', () => {
  it('renders the brand on the main feed', async () => {
    renderApp('/')
    await waitFor(() => expect(screen.getAllByText(/World Cup/i).length).toBeGreaterThan(0))
  })

  it('shows a not-found state for an unknown group id', async () => {
    renderApp('/group/Z')
    await waitFor(
      () => expect(screen.getByText(/not found/i)).toBeInTheDocument(),
      { timeout: 2000 },
    )
  })

  it('renders the match detail for a known match id', async () => {
    renderApp('/match/1000')
    await waitFor(
      () => {
        const brazil = screen.queryAllByText(/Brazil/i)
        expect(brazil.length).toBeGreaterThan(0)
      },
      { timeout: 2000 },
    )
  })

  it('shows match not-found for an unknown match id', async () => {
    renderApp('/match/zzz')
    await waitFor(
      () => expect(screen.getByText(/match not found/i)).toBeInTheDocument(),
      { timeout: 2000 },
    )
  })
})
