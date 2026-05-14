// Context providers for season + teams. Mount once at the app root; consumers
// read via the hooks. Teams are fetched once per season, then served from
// context to avoid per-component refetches.

import { createContext, useContext, useEffect, useState, useMemo } from 'react'
import { getTeams } from './scores.js'
import { getActiveSeason } from './season.js'

const SeasonCtx = createContext(2026)
const TeamsCtx = createContext({ teams: {}, loading: true, error: null })

export function SeasonProvider({ children }) {
  const [season, setSeason] = useState(getActiveSeason())
  useEffect(() => {
    const onPop = () => setSeason(getActiveSeason())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  return <SeasonCtx.Provider value={season}>{children}</SeasonCtx.Provider>
}

export function useSeason() { return useContext(SeasonCtx) }

export function TeamsProvider({ children }) {
  const season = useSeason()
  const [state, setState] = useState({ teams: {}, loading: true, error: null })
  useEffect(() => {
    let alive = true
    setState(s => ({ ...s, loading: true }))
    getTeams(season)
      .then(list => {
        if (!alive) return
        const teams = Object.fromEntries(list.map(t => [t.short, t]))
        setState({ teams, loading: false, error: null })
      })
      .catch(error => { if (alive) setState({ teams: {}, loading: false, error }) })
    return () => { alive = false }
  }, [season])
  const value = useMemo(() => state, [state])
  return <TeamsCtx.Provider value={value}>{children}</TeamsCtx.Provider>
}

export function useTeams() { return useContext(TeamsCtx) }

// Convenience: lookup with safe fallback to a placeholder team.
export function useTeam(short) {
  const { teams } = useTeams()
  return teams[short] || { short, name: short, code: 'un', confederation: null, id: 0 }
}
