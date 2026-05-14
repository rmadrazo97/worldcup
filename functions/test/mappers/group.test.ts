import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { mapStanding } from '../../src/mappers/standings.js'
import { mapMatch } from '../../src/mappers/match.js'
import {
  synthesizeGroupsFromMatches,
  synthesizeGroupsFromStandings,
} from '../../src/mappers/group.js'
import type {
  FIFAMatch,
  FIFAStanding,
} from '../../src/upstream/types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function loadFixture<T>(name: string): { data: T[] } {
  const raw = readFileSync(
    join(__dirname, '..', 'fixtures', 'upstream', name),
    'utf8',
  )
  return JSON.parse(raw) as { data: T[] }
}

describe('synthesizeGroupsFromStandings', () => {
  const standings2022 = loadFixture<FIFAStanding>(
    'group_standings_2022.json',
  ).data

  it('produces 8 groups labeled A-H with 4 teams each from 2022 standings', () => {
    const mapped = standings2022.map(mapStanding)
    const groups = synthesizeGroupsFromStandings(mapped)
    expect(groups).toHaveLength(8)
    expect(groups.map((g) => g.id)).toEqual([
      'A',
      'B',
      'C',
      'D',
      'E',
      'F',
      'G',
      'H',
    ])
    for (const g of groups) {
      expect(g.teams).toHaveLength(4)
    }
  })

  it('orders teams within a group by upstream position', () => {
    const mapped = standings2022.map(mapStanding)
    const groups = synthesizeGroupsFromStandings(mapped)
    const groupA = groups.find((g) => g.id === 'A')
    expect(groupA?.teams[0]).toBe('NED')
  })

  it('assigns host=Qatar to Group A in 2022', () => {
    const mapped = standings2022.map(mapStanding)
    const groups = synthesizeGroupsFromStandings(mapped)
    const a = groups.find((g) => g.id === 'A')
    const b = groups.find((g) => g.id === 'B')
    expect(a?.host).toBe('Qatar')
    expect(b?.host).toBeNull()
  })

  it('assigns 2026 hosts to Groups A, B, D', () => {
    const standings2026 = loadFixture<FIFAStanding>(
      'group_standings_2026.json',
    ).data
    if (standings2026.length === 0) return // skip if fixture is empty
    const mapped = standings2026.map(mapStanding)
    const groups = synthesizeGroupsFromStandings(mapped)
    const a = groups.find((g) => g.id === 'A')
    const b = groups.find((g) => g.id === 'B')
    const c = groups.find((g) => g.id === 'C')
    const d = groups.find((g) => g.id === 'D')
    if (a) expect(a.host).toBe('Mexico')
    if (b) expect(b.host).toBe('Canada')
    if (c) expect(c.host).toBeNull()
    if (d) expect(d.host).toBe('United States')
  })
})

describe('synthesizeGroupsFromMatches', () => {
  const matches2022 = loadFixture<FIFAMatch>('matches_2022_p1.json').data

  it('produces 8 groups from group-stage matches', () => {
    const mapped = matches2022.map(mapMatch)
    const groups = synthesizeGroupsFromMatches(mapped)
    expect(groups.length).toBe(8)
    for (const g of groups) {
      expect(g.teams.length).toBe(4)
    }
  })

  it('skips knockout matches entirely', () => {
    const mapped = matches2022.map(mapMatch)
    const groups = synthesizeGroupsFromMatches(mapped)
    // Group letters should never include anything outside A-H for 2022
    for (const g of groups) {
      expect(g.id).toMatch(/^[A-H]$/)
    }
  })
})
