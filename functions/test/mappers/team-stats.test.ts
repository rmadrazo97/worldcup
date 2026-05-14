import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { mapTeamStats } from '../../src/mappers/team-stats.js'
import type { FIFATeamMatchStats } from '../../src/upstream/types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function loadFixture(name: string): { data: FIFATeamMatchStats[] } {
  const raw = readFileSync(
    join(__dirname, '..', 'fixtures', 'upstream', name),
    'utf8',
  )
  return JSON.parse(raw) as { data: FIFATeamMatchStats[] }
}

describe('mapTeamStats', () => {
  const rows = loadFixture('team_match_stats_match1000.json').data

  it('produces possession [69, 31] for match 1000', () => {
    const stats = mapTeamStats(rows, 'ARG', 'KSA')
    expect(stats.values['Possession']).toEqual([69, 31])
    expect(stats.labels).toContain('Possession')
  })

  it('produces shots [15, 3] for match 1000', () => {
    const stats = mapTeamStats(rows, 'ARG', 'KSA')
    expect(stats.values['Shots']).toEqual([15, 3])
  })

  it('produces on-target [6, 2] for match 1000', () => {
    const stats = mapTeamStats(rows, 'ARG', 'KSA')
    expect(stats.values['On target']).toEqual([6, 2])
  })

  it('produces corners [9, 2] and fouls [7, 21] for match 1000', () => {
    const stats = mapTeamStats(rows, 'ARG', 'KSA')
    expect(stats.values['Corners']).toEqual([9, 2])
    expect(stats.values['Fouls']).toEqual([7, 21])
  })

  it('computes Pass acc% from passes_total and passes_accurate', () => {
    const stats = mapTeamStats(rows, 'ARG', 'KSA')
    // ARG: 508/596 = 85.23% → 85; KSA: 181/266 = 68.04% → 68
    expect(stats.values['Pass acc%']).toEqual([85, 68])
  })

  it('emits xG when expected_goals is present on both sides', () => {
    const stats = mapTeamStats(rows, 'ARG', 'KSA')
    expect(stats.xG).not.toBeNull()
    expect(stats.xG?.[0]).toBeCloseTo(2.26, 2)
    expect(stats.xG?.[1]).toBeCloseTo(0.15, 2)
  })

  it('returns xG = null when both sides lack expected_goals', () => {
    const stripped = rows.map((r) => ({ ...r, expected_goals: null }))
    const stats = mapTeamStats(stripped, 'ARG', 'KSA')
    expect(stats.xG).toBeNull()
  })

  it('emits labels in canonical order', () => {
    const stats = mapTeamStats(rows, 'ARG', 'KSA')
    expect(stats.labels).toEqual([
      'Possession',
      'Shots',
      'On target',
      'Corners',
      'Fouls',
      'Pass acc%',
    ])
  })
})
