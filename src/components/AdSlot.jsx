import { useEffect, useRef } from 'react'
import { adsConfig, adsReady, loadAdsScript } from '../api/ads.js'

// Renders a single AdSense responsive display unit. When AdSense is
// unconfigured or disabled the component returns null — pages never reserve
// space for an ad that won't load.
export default function AdSlot({ slot, label = 'Advertisement', format = 'auto', layout, style }) {
  const pushedRef = useRef(false)

  useEffect(() => {
    if (!adsReady() || !slot) return
    loadAdsScript()
    if (pushedRef.current) return
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
      pushedRef.current = true
    } catch { /* duplicate push or pre-load — adsbygoogle queues for us */ }
  }, [slot])

  if (!adsReady() || !slot) return null

  return (
    <aside className="ad-slot" aria-label={label}>
      <span className="ad-slot-label">{label}</span>
      <ins
        className="adsbygoogle"
        style={style || { display: 'block' }}
        data-ad-client={adsConfig.clientId}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
        {...(layout ? { 'data-ad-layout': layout } : {})}
      />
    </aside>
  )
}
