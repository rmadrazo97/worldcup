// Lightweight analytics surface that wraps Firebase Analytics. All calls
// silently no-op when analytics is unavailable (emulator, unsupported
// browsers, missing measurementId). Keep event names snake_case to match
// GA4 conventions.

import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { track } from './client.js'

export { track }

// Fire `page_view` whenever the route changes. Mounted once at app root.
export function usePageViews() {
  const loc = useLocation()
  const lastRef = useRef('')
  useEffect(() => {
    const path = loc.pathname + (loc.search || '')
    if (path === lastRef.current) return
    lastRef.current = path
    track('page_view', {
      page_path: path,
      page_location: typeof window !== 'undefined' ? window.location.href : '',
      page_title: typeof document !== 'undefined' ? document.title : '',
    })
  }, [loc])
}

// Debounced `search` event so we don't flood Analytics with one event per
// keystroke. 600ms feels close to "user paused typing".
export function useTrackSearch(query) {
  const tRef = useRef(null)
  useEffect(() => {
    if (tRef.current) clearTimeout(tRef.current)
    const q = (query || '').trim()
    if (!q) return
    tRef.current = setTimeout(() => {
      track('search', { search_term: q })
    }, 600)
    return () => tRef.current && clearTimeout(tRef.current)
  }, [query])
}
