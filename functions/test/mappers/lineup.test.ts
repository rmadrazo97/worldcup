import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { mapLineup } from '../../src/mappers/lineup.js'
import type { FIFAMatchLineupRow } from '../../src/upstream/types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function loadFixture<T>(name: string): { data: T[] } {
  const raw = readFileSync(
    join(__dirname, '..', 'fixtures', 'upstream', name),
    'utf8',
  )
  return JSON.parse(raw) as { data: T[] }
}

describe('mapLineup', () => {
  const rows = loadFixture<FIFAMatchLineupRow>(
    'match_lineups_match1000.json',
  ).data

  it('returns 11 starters and a formation for the home (ARG) team', () => {
    // home team in match 1000 is Argentina (id 37)
    const lineup = mapLineup(rows, 37, 'ARG')
    expect(lineup.team).toBe('ARG')
    expect(lineup.starters).toHaveLength(11)
    expect(lineup.formation).toBe('4-4-2')
    expect(lineup.coach).toBeNull()
  })

  it('sorts starters by shirt number ascending', () => {
    const lineup = mapLineup(rows, 37, 'ARG')
    const shirts = lineup.starters.map((p) => p.n)
    expect(shirts).toEqual([3, 5, 7, 10, 11, 13, 17, 19, 22, 23, 26])
  })

  it('maps player positions to internal 2-letter codes', () => {
    const lineup = mapLineup(rows, 37, 'ARG')
    const positions = new Set(lineup.starters.map((p) => p.position))
    for (const p of positions) {
      if (p !== null) {
        expect(['GK', 'DF', 'MF', 'FW']).toContain(p)
      }
    }
  })

  it('returns subs sorted by shirt number', () => {
    const lineup = mapLineup(rows, 37, 'ARG')
    const shirts = lineup.subs.map((p) => p.n ?? Number.MAX_SAFE_INTEGER)
    const sorted = [...shirts].sort((a, b) => a - b)
    expect(shirts).toEqual(sorted)
  })

  it('maps the away (KSA) team lineup independently', () => {
    const lineup = mapLineup(rows, 31, 'KSA')
    expect(lineup.team).toBe('KSA')
    expect(lineup.formation).toBe('4-1-4-1')
    expect(lineup.starters).toHaveLength(11)
  })

  it('starters carry id and either short_name or name', () => {
    const lineup = mapLineup(rows, 37, 'ARG')
    for (const p of lineup.starters) {
      expect(typeof p.id).toBe('number')
      expect(p.name.length).toBeGreaterThan(0)
    }
  })
})
