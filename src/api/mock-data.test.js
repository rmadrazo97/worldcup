import { describe, expect, it } from 'vitest'
import { GROUPS, MATCHES, TEAMS, VENUES, computeStandings } from './mock-data.js'

describe('mock-data integrity', () => {
  it('TEAMS has 48 entries (12 groups × 4 teams)', () => {
    expect(Object.keys(TEAMS)).toHaveLength(48)
  })

  it('GROUPS has 12 entries A–L with 4 teams each', () => {
    expect(GROUPS).toHaveLength(12)
    expect(GROUPS.map((g) => g.id)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'])
    GROUPS.forEach((g) => expect(g.teams).toHaveLength(4))
  })

  it('VENUES has 16 stadium codes', () => {
    expect(Object.keys(VENUES)).toHaveLength(16)
  })

  it('MATCHES has 72 entries with the expected status vocabulary', () => {
    expect(MATCHES).toHaveLength(72)
    const statuses = new Set(MATCHES.map((m) => m.status))
    statuses.forEach((s) => expect(['FT', 'LIVE', 'SCHED']).toContain(s))
  })

  it('computeStandings returns 4 ranked rows summing P, W, D, L coherently', () => {
    const groupA = GROUPS[0]
    const rows = computeStandings(groupA, MATCHES)
    expect(rows).toHaveLength(4)
    rows.forEach((r) => {
      expect(r.pld).toBe(r.w + r.d + r.l)
      expect(r.gd).toBe(r.gf - r.ga)
      expect(r.pts).toBe(r.w * 3 + r.d)
    })
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].pts).toBeGreaterThanOrEqual(rows[i].pts)
    }
  })
})
