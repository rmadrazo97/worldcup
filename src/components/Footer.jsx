// Build identifiers injected by Vite (`define` in vite.config.js).
// eslint-disable-next-line no-undef
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0'
// eslint-disable-next-line no-undef
const APP_COMMIT  = typeof __APP_COMMIT__  !== 'undefined' ? __APP_COMMIT__  : 'dev'
// eslint-disable-next-line no-undef
const APP_BUILT   = typeof __APP_BUILD_TIME__ !== 'undefined' ? __APP_BUILD_TIME__ : ''

export default function Footer() {
  const versionLabel = `v${APP_VERSION} · ${APP_COMMIT}`
  const versionTitle = APP_BUILT ? `Built ${APP_BUILT}` : versionLabel
  return (
    <footer className="footer">
      <div className="shell">
        <p className="footer-line">
          2026 FIFA World Cup
          <span className="dot">·</span>
          Canada · Mexico · United States
          <span className="dot">·</span>
          June 11 – July 19
        </p>
        <p className="footer-line footer-attribution">
          © 2026 <strong>ACLOUDBREW STUDIOS LLC</strong>
          <span className="dot">·</span>
          All rights reserved
          <span className="dot">·</span>
          <a href="mailto:acloudbrew@proton.me">acloudbrew@proton.me</a>
        </p>
        <p className="footer-line footer-fine">
          Not affiliated with FIFA. Live scores, fixtures and group standings updated in real time.
        </p>
        <p className="footer-line footer-version" title={versionTitle}>
          <span className="footer-version-label">{versionLabel}</span>
        </p>
      </div>
    </footer>
  )
}
