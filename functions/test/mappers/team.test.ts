import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { mapTeam } from '../../src/mappers/team.js'
import type { FIFATeam } from '../../src/upstream/types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function loadFixture(name: string): { data: FIFATeam[] } {
  const raw = readFileSync(
    join(__dirname, '..', 'fixtures', 'upstream', name),
    'utf8',
  )
  return JSON.parse(raw) as { data: FIFATeam[] }
}

describe('mapTeam', () => {
  const teams2022 = loadFixture('teams_2022.json').data
  const teams2026 = loadFixture('teams_2026.json').data

  it('maps Argentina (id 37) to ARG / ar / CONMEBOL', () => {
    const arg = teams2022.find((t) => t.id === 37)
    expect(arg).toBeDefined()
    const mapped = mapTeam(arg as FIFATeam)
    expect(mapped).toEqual({
      id: 37,
      short: 'ARG',
      name: 'Argentina',
      code: 'ar',
      confederation: 'CONMEBOL',
    })
  })

  it('maps Brazil to br', () => {
    const bra = teams2022.find((t) => t.id === 9)
    const mapped = mapTeam(bra as FIFATeam)
    expect(mapped.short).toBe('BRA')
    expect(mapped.code).toBe('br')
  })

  it('uses FLAG_OVERRIDES for England → gb-eng', () => {
    const eng = teams2022.find((t) => t.id === 45)
    const mapped = mapTeam(eng as FIFATeam)
    expect(mapped.short).toBe('ENG')
    expect(mapped.code).toBe('gb-eng')
  })

  it('uses FLAG_OVERRIDES for Wales → gb-wls', () => {
    const wal = teams2022.find((t) => t.name === 'Wales')
    const mapped = mapTeam(wal as FIFATeam)
    expect(mapped.short).toBe('WAL')
    expect(mapped.code).toBe('gb-wls')
  })

  it('uses FLAG_OVERRIDES for Scotland → gb-sct', () => {
    const sco = teams2026.find((t) => t.id === 12)
    const mapped = mapTeam(sco as FIFATeam)
    expect(mapped.short).toBe('SCO')
    expect(mapped.code).toBe('gb-sct')
  })

  it('falls back to country_code first 2 chars for unknown ISO-3 inputs', () => {
    const fake: FIFATeam = {
      id: 99999,
      name: 'Atlantis',
      abbreviation: 'ATL',
      country_code: 'XYZ',
      confederation: null,
    }
    const mapped = mapTeam(fake)
    expect(mapped.short).toBe('ATL')
    expect(mapped.code).toBe('xy')
  })

  it('derives short from country_code when abbreviation is missing', () => {
    const fake: FIFATeam = {
      id: 99999,
      name: 'Atlantis',
      abbreviation: null,
      country_code: 'BRA',
      confederation: null,
    }
    const mapped = mapTeam(fake)
    expect(mapped.short).toBe('BRA')
  })

  it('derives short from name when both abbreviation and country_code missing', () => {
    const fake: FIFATeam = {
      id: 99999,
      name: 'Atlantis',
      abbreviation: null,
      country_code: null,
      confederation: null,
    }
    const mapped = mapTeam(fake)
    expect(mapped.short).toBe('ATL')
    expect(mapped.code).toBe('')
  })

  it('covers every team in the 2022 fixture with a non-empty code', () => {
    for (const t of teams2022) {
      const mapped = mapTeam(t)
      expect(mapped.code.length).toBeGreaterThan(0)
      expect(mapped.short.length).toBe(3)
    }
  })

  it('covers every team in the 2026 fixture with a non-empty code', () => {
    for (const t of teams2026) {
      const mapped = mapTeam(t)
      expect(mapped.code.length).toBeGreaterThan(0)
      expect(mapped.short.length).toBe(3)
    }
  })
})
