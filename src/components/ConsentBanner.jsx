import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  applyConsent,
  getStoredConsent,
  setStoredConsent,
  OPEN_CONSENT_EVENT,
} from '../api/consent.js'

export default function ConsentBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const stored = getStoredConsent()
    if (!stored) setVisible(true)
    else applyConsent(stored)
    const reopen = () => setVisible(true)
    window.addEventListener(OPEN_CONSENT_EVENT, reopen)
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, reopen)
  }, [])

  if (!visible) return null

  const decide = (granted) => {
    const choice = {
      ads:       granted ? 'granted' : 'denied',
      analytics: granted ? 'granted' : 'denied',
      ts:        Date.now(),
    }
    setStoredConsent(choice)
    applyConsent(choice)
    setVisible(false)
  }

  return (
    <div className="consent-banner" role="dialog" aria-modal="false" aria-label="Cookie preferences">
      <div className="consent-inner">
        <p className="consent-text">
          We use cookies for analytics and to show ads that keep this site free.
          See our <Link to="/privacy">Privacy Policy</Link> for details. You can
          change your choice anytime from the footer.
        </p>
        <div className="consent-actions">
          <button type="button" className="consent-btn consent-btn-secondary" onClick={() => decide(false)}>
            Reject
          </button>
          <button type="button" className="consent-btn consent-btn-primary" onClick={() => decide(true)}>
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}
