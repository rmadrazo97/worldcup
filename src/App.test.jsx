import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from './App.jsx'

describe('App routing', () => {
  it('renders the brand on the main feed', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )
    await waitFor(() => expect(screen.getAllByText(/World Cup/i).length).toBeGreaterThan(0))
  })

  it('shows a not-found state for an unknown group id', async () => {
    render(
      <MemoryRouter initialEntries={['/group/zzz']}>
        <App />
      </MemoryRouter>,
    )
    await waitFor(
      () => expect(screen.getByText(/not found/i)).toBeInTheDocument(),
      { timeout: 2000 },
    )
  })

  it('renders the lineup pitch for a known match', async () => {
    render(
      <MemoryRouter initialEntries={['/match/C2-1']}>
        <App />
      </MemoryRouter>,
    )
    await waitFor(
      () => {
        const brazil = screen.queryAllByText(/Brazil/i)
        expect(brazil.length).toBeGreaterThan(0)
      },
      { timeout: 2000 },
    )
  })

  it('shows match not-found for an unknown match id', async () => {
    render(
      <MemoryRouter initialEntries={['/match/zzz']}>
        <App />
      </MemoryRouter>,
    )
    await waitFor(
      () => expect(screen.getByText(/match not found/i)).toBeInTheDocument(),
      { timeout: 2000 },
    )
  })
})
