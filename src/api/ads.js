// AdSense configuration surface. All values come from Vite env vars so the
// build artifact is identical across environments; production sets the IDs.
//
// `ready()` is the single gate every ad-related code path checks. When it
// returns false, no script is fetched and no slot renders — the kill switch
// and the "AdSense not approved yet" state both flow through here.

const truthy = (v) => v !== 'false' && v !== false && v != null && v !== ''

export const adsConfig = {
  enabled: truthy(import.meta.env.VITE_ADS_ENABLED ?? 'true'),
  clientId: import.meta.env.VITE_ADSENSE_CLIENT_ID || '',
  slots: {
    home:  import.meta.env.VITE_ADSENSE_SLOT_HOME  || '',
    group: import.meta.env.VITE_ADSENSE_SLOT_GROUP || '',
    match: import.meta.env.VITE_ADSENSE_SLOT_MATCH || '',
  },
}

export function adsReady() {
  return adsConfig.enabled && !!adsConfig.clientId
}

// Idempotent loader for the AdSense pagead2 script. Safe to call from any
// number of mount sites — subsequent calls are no-ops.
let _loaded = false
export function loadAdsScript() {
  if (_loaded || !adsReady()) return
  if (typeof document === 'undefined') return
  if (document.querySelector('script[data-adsense-loader="1"]')) {
    _loaded = true
    return
  }
  const s = document.createElement('script')
  s.async = true
  s.crossOrigin = 'anonymous'
  s.dataset.adsenseLoader = '1'
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(adsConfig.clientId)}`
  document.head.appendChild(s)
  _loaded = true
}
