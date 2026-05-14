// Google Consent Mode v2 management.
//
// Defaults are set "denied" inline in index.html before any analytics or ad
// code runs. This module reads the user's persisted choice on boot, applies
// it via gtag('consent', 'update', ...), and exposes helpers for the banner
// and the "Cookie settings" footer button to update or re-open the prompt.

const KEY = 'wc26.consent.v1' // gitleaks:allow — localStorage key, not a secret

export function getStoredConsent() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function setStoredConsent(value) {
  try { localStorage.setItem(KEY, JSON.stringify(value)) } catch { /* noop */ }
}

export function clearStoredConsent() {
  try { localStorage.removeItem(KEY) } catch { /* noop */ }
}

export function applyConsent(choice) {
  if (typeof window === 'undefined') return
  const gtag = window.gtag
  if (typeof gtag !== 'function') return
  gtag('consent', 'update', {
    ad_storage:         choice.ads       === 'granted' ? 'granted' : 'denied',
    ad_user_data:       choice.ads       === 'granted' ? 'granted' : 'denied',
    ad_personalization: choice.ads       === 'granted' ? 'granted' : 'denied',
    analytics_storage:  choice.analytics === 'granted' ? 'granted' : 'denied',
  })
}

export const OPEN_CONSENT_EVENT = 'wc26:open-consent'

export function openConsentBanner() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(OPEN_CONSENT_EVENT))
}
