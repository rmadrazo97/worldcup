// Async API surface for World Cup data.
//
// Currently wraps the in-memory mock data. When a live source is wired up,
// replace the function bodies with `fetch('/api/...')` calls — the public
// signatures must not change so call sites stay untouched.

import {
  TEAMS,
  GROUPS,
  VENUES,
  MATCHES,
  computeStandings,
  LINEUPS,
  MATCH_DETAILS,
  FORMATIONS,
} from './mock-data.js'

const delay = (ms = 0) => new Promise((r) => setTimeout(r, ms))
const clone = (x) => structuredClone(x)

export async function getTeams() {
  await delay()
  return clone(TEAMS)
}

export async function getGroups() {
  await delay()
  return clone(GROUPS)
}

export async function getVenues() {
  await delay()
  return clone(VENUES)
}

export async function getMatches({ status, group, date } = {}) {
  await delay()
  let m = MATCHES
  if (status) m = m.filter((x) => x.status === status)
  if (group) m = m.filter((x) => x.group === group)
  if (date) m = m.filter((x) => x.date === date)
  return clone(m)
}

export async function getMatchById(id) {
  await delay()
  return clone(MATCHES.find((m) => m.id === id) || null)
}

export async function getStandings(groupId) {
  await delay()
  const group = GROUPS.find((g) => g.id === groupId)
  if (!group) return []
  return computeStandings(group, MATCHES)
}

export async function getLineup(teamCode) {
  await delay()
  return clone(LINEUPS[teamCode] || null)
}

export async function getMatchDetails(matchId) {
  await delay()
  return clone(MATCH_DETAILS[matchId] || null)
}

export async function getFormation(name) {
  await delay()
  return clone(FORMATIONS[name] || FORMATIONS['4-3-3'])
}
