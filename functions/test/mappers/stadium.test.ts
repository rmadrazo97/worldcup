import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  dedupeVenueShorts,
  deriveVenueShort,
  mapStadium,
} from '../../src/mappers/stadium.js'
import type { FIFAStadium } from '../../src/upstream/types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function loadFixture(name: string): { data: FIFAStadium[] } {
  const raw = readFileSync(
    join(__dirname, '..', 'fixtures', 'upstream', name),
    'utf8',
  )
  return JSON.parse(raw) as { data: FIFAStadium[] }
}

describe('mapStadium', () => {
  const stadiums2022 = loadFixture('stadiums_2022.json').data
  const stadiums2026 = loadFixture('stadiums_2026.json').data

  it('synthesises a 3-letter uppercase short for every 2022 stadium', () => {
    for (const s of stadiums2022) {
      const mapped = mapStadium(s)
      expect(mapped.short).toHaveLength(3)
      expect(mapped.short).toBe(mapped.short.toUpperCase())
    }
  })

  it('maps Ahmed bin Ali Stadium deterministically', () => {
    const a = stadiums2022.find((s) => s.name === 'Ahmed bin Ali Stadium')
    expect(a).toBeDefined()
    const mapped = mapStadium(a as FIFAStadium)
    expect(mapped.short).toBe('ABA')
    expect(mapped.id).toBe(470)
    expect(mapped.name).toBe('Ahmed bin Ali Stadium')
    expect(mapped.city).toBe(a?.city)
    expect(mapped.capacity).toBe(a?.capacity)
  })

  it('skips noise words when deriving short', () => {
    // "The Stadium at Foobar" → first significant words: "Foobar"
    expect(deriveVenueShort('The Stadium at Foobar')).toBe('FOO')
  })

  it('pads from the first word when fewer than 3 significant words', () => {
    expect(deriveVenueShort('Wembley Stadium')).toBe('WEM')
  })

  it('handles single-word names', () => {
    expect(deriveVenueShort('Anfield')).toBe('ANF')
  })

  it('dedupeVenueShorts handles collisions deterministically', () => {
    const a = mapStadium({
      id: 1,
      name: 'Aaa Bbb Ccc',
      city: null,
      country: null,
      capacity: null,
      latitude: null,
      longitude: null,
    })
    const b = mapStadium({
      id: 2,
      name: 'Aaa Bbb Ccc',
      city: null,
      country: null,
      capacity: null,
      latitude: null,
      longitude: null,
    })
    const c = mapStadium({
      id: 3,
      name: 'Aaa Bbb Ccc',
      city: null,
      country: null,
      capacity: null,
      latitude: null,
      longitude: null,
    })
    const out = dedupeVenueShorts([a, b, c])
    expect(out.map((v) => v.short)).toEqual(['ABC', 'AB2', 'AB3'])
  })

  it('synthesises distinct shorts after dedupe for 2022 stadiums', () => {
    const mapped = stadiums2022.map(mapStadium)
    const deduped = dedupeVenueShorts(mapped)
    const shorts = deduped.map((v) => v.short)
    expect(new Set(shorts).size).toBe(shorts.length)
  })

  it('synthesises distinct shorts after dedupe for 2026 stadiums', () => {
    const mapped = stadiums2026.map(mapStadium)
    const deduped = dedupeVenueShorts(mapped)
    const shorts = deduped.map((v) => v.short)
    expect(new Set(shorts).size).toBe(shorts.length)
  })
})
