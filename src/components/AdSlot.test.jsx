import { render } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../api/ads.js', () => ({
  adsConfig: { clientId: 'ca-pub-3627469464584624', slots: {} },
  adsReady: vi.fn(),
  loadAdsScript: vi.fn(),
}))

import AdSlot from './AdSlot.jsx'
import { adsReady } from '../api/ads.js'

beforeEach(() => {
  adsReady.mockReset()
  // jsdom doesn't define adsbygoogle; AdSlot's useEffect pushes to it.
  // eslint-disable-next-line no-undef
  if (typeof window !== 'undefined') window.adsbygoogle = []
})

describe('AdSlot', () => {
  it('renders nothing when adsReady is false', () => {
    adsReady.mockReturnValue(false)
    const { container } = render(<AdSlot slot="1234567890" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when slot is empty', () => {
    adsReady.mockReturnValue(true)
    const { container } = render(<AdSlot slot="" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders an <ins.adsbygoogle> with client + slot when configured', () => {
    adsReady.mockReturnValue(true)
    const { container } = render(<AdSlot slot="1234567890" />)
    const ins = container.querySelector('ins.adsbygoogle')
    expect(ins).not.toBeNull()
    expect(ins.getAttribute('data-ad-client')).toBe('ca-pub-3627469464584624')
    expect(ins.getAttribute('data-ad-slot')).toBe('1234567890')
  })
})
