import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { computeStandings, mapStanding } from '../../src/mappers/standings.js'
import { mapMatch } from '../../src/mappers/match.js'
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

describe('mapStanding', () => {
  const standings2022 = loadFixture<FIFAStanding>(
    'group_standings_2022.json',
  ).data

  it('maps Group A row 1 (Netherlands) correctly', () => {
    const ga = standings2022
      .filter((s) => s.group.name === 'Group A')
      .sort((a, b) => a.position - b.position)
    const first = ga[0]
    expect(first).toBeDefined()
    const mapped = mapStanding(first as FIFAStanding)
    expect(mapped.team).toBe('NED')
    expect(mapped.teamShort).toBe('NED')
    expect(mapped.teamId).toBe(21)
    expect(mapped.pos).toBe(1)
    expect(mapped.pts).toBe(7)
    expect(mapped.pld).toBe(3)
    expect(mapped.w).toBe(2)
    expect(mapped.d).toBe(1)
    expect(mapped.l).toBe(0)
    expect(mapped.gf).toBe(5)
    expect(mapped.ga).toBe(1)
    expect(mapped.gd).toBe(4)
    expect(mapped.groupId).toBe('A')
    expect(mapped.season).toBe(2022)
  })

  it('all standings have a single-letter groupId', () => {
    for (const s of standings2022) {
      const mapped = mapStanding(s)
      expect(mapped.groupId).toMatch(/^[A-Z]$/)
    }
  })
})

describe('computeStandings (fallback)', () => {
  const matches2022 = loadFixture<FIFAMatch>('matches_2022_p1.json').data

  it('produces 4 rows for Group C from completed 2022 matches', () => {
    const mapped = matches2022.map(mapMatch)
    const rows = computeStandings(mapped, 'C')
    expect(rows).toHaveLength(4)
    // pts descending
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1]
      const curr = rows[i]
      expect(prev).toBeDefined()
      expect(curr).toBeDefined()
      expect((prev as { pts: number }).pts).toBeGreaterThanOrEqual(
        (curr as { pts: number }).pts,
      )
    }
    expect(rows[0]?.pos).toBe(1)
    expect(rows[3]?.pos).toBe(4)
  })

  it('ignores non-FT and non-matching-group matches', () => {
    const mapped = matches2022.map(mapMatch)
    const rowsA = computeStandings(mapped, 'A')
    expect(rowsA).toHaveLength(4)
    // Group A 2022: Netherlands (NED) topped with 7 pts in the upstream
    // standings — our fallback should agree.
    const ned = rowsA.find((r) => r.team === 'NED')
    expect(ned?.pts).toBe(7)
    expect(ned?.pos).toBe(1)
  })

  it('returns empty array for non-existent group', () => {
    const mapped = matches2022.map(mapMatch)
    expect(computeStandings(mapped, 'Z')).toEqual([])
  })
})
