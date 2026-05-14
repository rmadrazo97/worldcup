import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { mapMatch } from '../../src/mappers/match.js'
import type { FIFAMatch } from '../../src/upstream/types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function loadMatches(name: string): FIFAMatch[] {
  const raw = readFileSync(
    join(__dirname, '..', 'fixtures', 'upstream', name),
    'utf8',
  )
  return (JSON.parse(raw) as { data: FIFAMatch[] }).data
}

describe('mapMatch', () => {
  const matches2022 = loadMatches('matches_2022_p1.json')
  const matches2026 = loadMatches('matches_2026_p1.json')

  it('maps match 1000 (ARG vs KSA, 2022 group stage) correctly', () => {
    const m = matches2022.find((x) => x.id === 1000)
    expect(m).toBeDefined()
    const out = mapMatch(m as FIFAMatch)
    expect(out.id).toBe('1000')
    expect(out.season).toBe(2022)
    expect(out.status).toBe('FT')
    expect(out.stage).toBe('group')
    expect(out.stage_label.startsWith('Group')).toBe(true)
    expect(out.group).toBe('C')
    expect(out.md).toBe(1)
    expect(out.home).toBe('ARG')
    expect(out.away).toBe('KSA')
    expect(out.homeId).toBe(37)
    expect(out.awayId).toBe(31)
    expect(out.hs).toBe(1)
    expect(out.as).toBe(2)
    expect(out.pens).toBeNull()
    expect(out.kickoff_iso).toBe('2022-11-22T10:00:00.000Z')
    expect(out.venueId).toBe(473)
    expect(out.venueShort).toBe('LUS')
    expect(out.minute).toBeNull()
  })

  it('produces "Group C · MD 1" as stage_label for match 1000', () => {
    const m = matches2022.find((x) => x.id === 1000)
    const out = mapMatch(m as FIFAMatch)
    expect(out.stage_label).toBe('Group C · MD 1')
  })

  it('returns null scores for scheduled matches (2026)', () => {
    const sched = matches2026.find((x) => x.status === 'scheduled')
    expect(sched).toBeDefined()
    const out = mapMatch(sched as FIFAMatch)
    expect(out.status).toBe('SCHED')
    expect(out.hs).toBeNull()
    expect(out.as).toBeNull()
    expect(out.pens).toBeNull()
  })

  it('maps Round of 16 stage and label', () => {
    const r16 = matches2022.find((x) => x.stage.name === 'Round of 16')
    expect(r16).toBeDefined()
    const out = mapMatch(r16 as FIFAMatch)
    expect(out.stage).toBe('r16')
    expect(out.stage_label).toBe('Round of 16')
    expect(out.group).toBeNull()
    expect(out.md).toBeNull()
  })

  it('maps Quarterfinal stage and label', () => {
    const qf = matches2022.find((x) => x.stage.name === 'Quarterfinal')
    if (qf) {
      const out = mapMatch(qf)
      expect(out.stage).toBe('qf')
      expect(out.stage_label).toBe('Quarterfinal')
    }
  })

  it('passes through formation, referee, attendance', () => {
    const m = matches2022.find((x) => x.id === 1000)
    const out = mapMatch(m as FIFAMatch)
    expect(out.home_formation).toBe('4-4-2')
    expect(out.away_formation).toBe('4-1-4-1')
  })

  it('maps the 2022 final (ARG vs FRA, ET+pens) with hs=3, as=3, pens={4,2}', () => {
    const final = matches2022.find((m) => m.id === 999)
    expect(final).toBeDefined()
    const out = mapMatch(final as FIFAMatch)
    expect(out.status).toBe('FT')
    expect(out.stage).toBe('final')
    expect(out.stage_label).toBe('Final')
    expect(out.hs).toBe(3)
    expect(out.as).toBe(3)
    expect(out.pens).toEqual({ hs: 4, as: 2 })
  })

  it('handles unknown status by defaulting to SCHED', () => {
    const m = matches2022.find((x) => x.id === 1000) as FIFAMatch
    const fake: FIFAMatch = { ...m, status: 'aurora_borealis' }
    const out = mapMatch(fake)
    expect(out.status).toBe('SCHED')
  })

  it('maps every fixture entry without throwing', () => {
    for (const m of matches2022) {
      const out = mapMatch(m)
      expect(out.id).toBe(String(m.id))
    }
    for (const m of matches2026) {
      const out = mapMatch(m)
      expect(out.id).toBe(String(m.id))
    }
  })
})
