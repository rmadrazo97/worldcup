import { render } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'

import AdSlot from './AdSlot.jsx'

// Reset module cache so re-imports observe new env values.
beforeEach(() => {
  vi.resetModules()
  vi.unstubAllEnvs()
})

describe('AdSlot', () => {
  it('renders nothing when ads are disabled', () => {
    vi.stubEnv('VITE_ADS_ENABLED', 'false')
    vi.stubEnv('VITE_ADSENSE_CLIENT_ID', 'ca-pub-1234567890123456')
    const { container } = render(<AdSlot slot="1234567890" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when client ID is missing', () => {
    vi.stubEnv('VITE_ADS_ENABLED', 'true')
    vi.stubEnv('VITE_ADSENSE_CLIENT_ID', '')
    const { container } = render(<AdSlot slot="1234567890" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when slot is empty', () => {
    vi.stubEnv('VITE_ADS_ENABLED', 'true')
    vi.stubEnv('VITE_ADSENSE_CLIENT_ID', 'ca-pub-1234567890123456')
    const { container } = render(<AdSlot slot="" />)
    expect(container).toBeEmptyDOMElement()
  })
})
