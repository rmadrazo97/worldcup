import { beforeEach, describe, expect, it, vi } from 'vitest'
import { run, _resetForTests } from '../../src/cache/mutex.js'

beforeEach(() => {
  _resetForTests()
})

describe('cache/mutex.run', () => {
  it('coalesces 100 concurrent calls for the same key into one fn invocation', async () => {
    const fn = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 20))
      return 42
    })
    const results = await Promise.all(
      Array.from({ length: 100 }, () => run('k', fn)),
    )
    expect(fn).toHaveBeenCalledTimes(1)
    expect(new Set(results)).toEqual(new Set([42]))
  })

  it('different keys run independently', async () => {
    const fn = vi.fn(async (id: string) => {
      await new Promise((r) => setTimeout(r, 5))
      return id
    })
    const [a, b, c] = await Promise.all([
      run('a', () => fn('a')),
      run('b', () => fn('b')),
      run('c', () => fn('c')),
    ])
    expect(fn).toHaveBeenCalledTimes(3)
    expect([a, b, c]).toEqual(['a', 'b', 'c'])
  })

  it('removes the promise from the map after completion (next call re-runs fn)', async () => {
    const fn = vi.fn(async () => 'v')
    await run('k', fn)
    await run('k', fn)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('removes the promise even when fn rejects', async () => {
    const fn = vi.fn(async () => {
      throw new Error('boom')
    })
    await expect(run('k', fn)).rejects.toThrow('boom')
    await expect(run('k', fn)).rejects.toThrow('boom')
    expect(fn).toHaveBeenCalledTimes(2)
  })
})
