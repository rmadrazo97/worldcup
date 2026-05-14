import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { mapEvent } from '../../src/mappers/event.js'
import type { FIFAMatchEvent } from '../../src/upstream/types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function loadFixture<T>(name: string): { data: T[] } {
  const raw = readFileSync(
    join(__dirname, '..', 'fixtures', 'upstream', name),
    'utf8',
  )
  return JSON.parse(raw) as { data: T[] }
}

describe('mapEvent', () => {
  const events = loadFixture<FIFAMatchEvent>(
    'match_events_match1000.json',
  ).data
  const ctx = { homeShort: 'ARG', awayShort: 'KSA' }

  it('drops varDecision and injuryTime events (returns null)', () => {
    const var1 = events.find((e) => e.incident_type === 'varDecision')
    const inj = events.find((e) => e.incident_type === 'injuryTime')
    expect(var1).toBeDefined()
    expect(inj).toBeDefined()
    expect(mapEvent(var1 as FIFAMatchEvent, ctx)).toBeNull()
    expect(mapEvent(inj as FIFAMatchEvent, ctx)).toBeNull()
  })

  it('maps a penalty goal correctly (Messi 10\')', () => {
    const goal = events.find(
      (e) => e.incident_type === 'goal' && e.incident_class === 'penalty',
    )
    expect(goal).toBeDefined()
    const mapped = mapEvent(goal as FIFAMatchEvent, ctx)
    expect(mapped).not.toBeNull()
    expect(mapped?.type).toBe('penalty_goal')
    expect(mapped?.team).toBe('ARG')
    expect(mapped?.min).toBe("10'")
    expect(mapped?.score).toBe('1-0')
    expect(mapped?.player).toContain('Messi')
  })

  it('maps a regular goal with score string', () => {
    const goal = events.find(
      (e) => e.incident_type === 'goal' && e.incident_class === 'regular',
    )
    expect(goal).toBeDefined()
    const mapped = mapEvent(goal as FIFAMatchEvent, ctx)
    expect(mapped?.type).toBe('goal')
    expect(mapped?.score).toMatch(/^\d+-\d+$/)
    expect(mapped?.team).toBe('KSA')
  })

  it('maps a yellow card', () => {
    const card = events.find(
      (e) => e.incident_type === 'card' && e.incident_class === 'yellow',
    )
    expect(card).toBeDefined()
    const mapped = mapEvent(card as FIFAMatchEvent, ctx)
    expect(mapped?.type).toBe('yellow')
    expect(mapped?.team).toBe('KSA')
    expect(mapped?.player).toBeDefined()
  })

  it('maps a substitution with off/on players', () => {
    const sub = events.find(
      (e) => e.incident_type === 'substitution' && e.added_time !== 999,
    )
    expect(sub).toBeDefined()
    const mapped = mapEvent(sub as FIFAMatchEvent, ctx)
    expect(mapped?.type).toBe('sub')
    expect(mapped?.playerOff).toBeDefined()
    expect(mapped?.playerOn).toBeDefined()
  })

  it('maps period markers (45 → half, 90 → full)', () => {
    const periods = events.filter((e) => e.incident_type === 'period')
    expect(periods.length).toBeGreaterThanOrEqual(2)
    const half = periods.find((p) => p.time_minute === 45)
    const full = periods.find((p) => p.time_minute === 90)
    expect(half).toBeDefined()
    expect(full).toBeDefined()
    const mappedHalf = mapEvent(half as FIFAMatchEvent, ctx)
    const mappedFull = mapEvent(full as FIFAMatchEvent, ctx)
    expect(mappedHalf?.type).toBe('half')
    expect(mappedHalf?.team).toBeNull()
    expect(mappedFull?.type).toBe('full')
    expect(mappedFull?.team).toBeNull()
  })

  it('formats minutes with stoppage time as "45\'+2" when added_time is real', () => {
    // The 90'+2 yellow card
    const lateCard = events.find(
      (e) =>
        e.incident_type === 'card' &&
        e.time_minute === 90 &&
        e.added_time === 2,
    )
    expect(lateCard).toBeDefined()
    const mapped = mapEvent(lateCard as FIFAMatchEvent, ctx)
    expect(mapped?.min).toBe("90'+2")
  })

  it('mapping every fixture event yields only known types or null', () => {
    const validTypes = new Set([
      'goal',
      'own_goal',
      'penalty_goal',
      'penalty_missed',
      'yellow',
      'red',
      'second_yellow',
      'sub',
      'half',
      'full',
      'et_start',
      'et_half',
      'et_full',
      'pen_start',
      'shootout_kick',
      'var',
    ])
    for (const e of events) {
      const m = mapEvent(e, ctx)
      if (m !== null) {
        expect(validTypes.has(m.type)).toBe(true)
      }
    }
  })
})
