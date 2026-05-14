// Async API surface for World Cup data. Backed by Firebase callable functions
// with App Check. Public signatures are stable — only bodies change when the
// transport changes. An in-memory dedupe map collapses simultaneous identical
// calls into a single Promise and clears on next tick.

import { unwrapCallable } from './client.js'
import { getActiveSeason } from './season.js'
import { getFormation } from './formations.js'

const inflight = new Map()
function dedup(name, args) {
  const key = `${name}:${JSON.stringify(args)}`
  if (inflight.has(key)) return inflight.get(key)
  const p = unwrapCallable(name, args).finally(() => {
    // Drop on next tick so two synchronous callers get the same Promise,
    // but subsequent callers re-fetch fresh.
    setTimeout(() => inflight.delete(key), 0)
  })
  inflight.set(key, p)
  return p
}

export async function getTeams(season = getActiveSeason()) {
  const r = await dedup('getTeams', { season })
  return Array.isArray(r?.data) ? r.data : []
}

export async function getStadiums(season = getActiveSeason()) {
  const r = await dedup('getStadiums', { season })
  return Array.isArray(r?.data) ? r.data : []
}

// `getVenues` is a backwards-compat alias for getStadiums returning a map
// keyed by short -> name (the shape the legacy UI expected).
export async function getVenues(season = getActiveSeason()) {
  const list = await getStadiums(season)
  return Object.fromEntries(list.map(v => [v.short, v.name]))
}

export async function getGroups(season = getActiveSeason()) {
  const r = await dedup('getGroups', { season })
  return Array.isArray(r?.data) ? r.data : []
}

export async function getStandings(groupId, season = getActiveSeason()) {
  const r = await dedup('getStandings', { season, groupId })
  return Array.isArray(r?.data) ? r.data : []
}

export async function getMatches(filters = {}, season = getActiveSeason()) {
  const args = { season }
  if (filters.status) args.status = filters.status
  if (filters.group) args.group = filters.group
  if (filters.date) args.date = filters.date
  const r = await dedup('getMatches', args)
  return Array.isArray(r?.data) ? r.data : []
}

export async function getMatchById(matchId, season = getActiveSeason()) {
  const r = await dedup('getMatchById', { season, matchId: String(matchId) })
  return r?.data ?? null
}

export async function getMatchDetails(matchId, season = getActiveSeason()) {
  const r = await dedup('getMatchDetails', { season, matchId: String(matchId) })
  return r?.data ?? null
}

// Lineup is per-match in v2. Old call sites used `getLineup(teamCode)` with a
// single arg; warn and resolve to null so they fail soft until updated.
export async function getLineup(matchId, team, season = getActiveSeason()) {
  if (team === undefined) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('getLineup(team) is deprecated — call getLineup(matchId, team) instead')
    }
    return null
  }
  const r = await dedup('getLineup', { season, matchId: String(matchId), team })
  return r?.data ?? null
}

export { getFormation }
