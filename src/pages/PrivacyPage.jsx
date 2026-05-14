import { Link } from 'react-router-dom'
import Header from '../components/Header.jsx'
import Footer from '../components/Footer.jsx'
import { openConsentBanner } from '../api/consent.js'

const UPDATED = 'May 14, 2026'

export default function PrivacyPage() {
  return (
    <div className="app">
      <Header view="detail" onBack={() => window.history.back()} searchOpen={false} setSearchOpen={() => {}} query="" onQuery={() => {}} />
      <div className="shell">
        <article className="privacy-page">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link to="/" className="crumb">World Cup 2026</Link>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
            <span className="crumb is-current" aria-current="page">Privacy Policy</span>
          </nav>

          <header className="privacy-hero">
            <h1>Privacy Policy</h1>
            <p className="privacy-updated">Last updated: {UPDATED}</p>
          </header>

          <section>
            <h2>Who we are</h2>
            <p>
              This site (the &ldquo;Service&rdquo;) is operated by <strong>ACLOUDBREW STUDIOS LLC</strong>
              {' '}(&ldquo;we&rdquo;, &ldquo;us&rdquo;). It provides live scores, group standings,
              fixtures, and match details for the 2026 FIFA World Cup. We are not
              affiliated with FIFA. You can contact us at{' '}
              <a href="mailto:acloudbrew@proton.me">acloudbrew@proton.me</a>.
            </p>
          </section>

          <section>
            <h2>Information we collect</h2>
            <p>
              The Service does not require an account. We do not ask for your name,
              email, address, or phone number. We collect only what is needed to
              run a fast, reliable site and to support it with advertising:
            </p>
            <ul>
              <li>
                <strong>Usage data.</strong> Pages viewed, referring URL, device
                type, approximate region, language, and timestamps. We use this
                data in aggregate to understand traffic and improve the product.
              </li>
              <li>
                <strong>Technical identifiers.</strong> An anonymous Firebase
                Authentication user ID is created in your browser to enforce
                rate limits on our backend. It is not linked to any personal data.
              </li>
              <li>
                <strong>Advertising data.</strong> When you consent to ads, Google
                AdSense may set cookies or read device identifiers to deliver and
                measure ads. See &ldquo;Advertising&rdquo; below.
              </li>
            </ul>
          </section>

          <section>
            <h2>Cookies and similar technologies</h2>
            <p>We use three categories of cookies and local storage:</p>
            <ul>
              <li>
                <strong>Strictly necessary.</strong> Required for the site to
                function (e.g. storing your cookie choice, caching match data
                offline). Always on.
              </li>
              <li>
                <strong>Analytics.</strong> Google Analytics 4 via Firebase
                Analytics. Used to measure traffic and engagement. Off by
                default; enabled only if you accept.
              </li>
              <li>
                <strong>Advertising.</strong> Google AdSense cookies used to
                serve and measure ads, and (where you consent) to personalize
                them. Off by default; enabled only if you accept.
              </li>
            </ul>
            <p>
              You can change your choice at any time:{' '}
              <button type="button" className="link-btn" onClick={openConsentBanner}>
                Open cookie settings
              </button>
              .
            </p>
          </section>

          <section>
            <h2>Advertising (Google AdSense)</h2>
            <p>
              We use Google AdSense to display ads. Google and its partners may
              use cookies and similar technologies to serve ads based on your
              prior visits to this and other websites. With your consent, ads may
              be personalized; without consent, ads are non-personalized where
              required by law.
            </p>
            <p>
              You can manage your ad preferences directly with Google at{' '}
              <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer">
                adssettings.google.com
              </a>{' '}
              or opt out of third-party vendor cookies at{' '}
              <a href="https://www.aboutads.info/choices/" target="_blank" rel="noopener noreferrer">
                aboutads.info/choices
              </a>
              .
            </p>
          </section>

          <section>
            <h2>Third-party services</h2>
            <ul>
              <li><strong>Google Firebase</strong> (Hosting, Cloud Functions, Firestore, Authentication, App Check, Analytics) &mdash; infrastructure provider.</li>
              <li><strong>Google AdSense</strong> &mdash; advertising.</li>
              <li><strong>balldontlie.io</strong> &mdash; FIFA World Cup data feed.</li>
              <li><strong>flagcdn.com</strong> &mdash; country flag images.</li>
              <li><strong>Google reCAPTCHA Enterprise</strong> &mdash; abuse protection via Firebase App Check.</li>
            </ul>
            <p>
              Each of these providers operates under its own privacy policy. We
              do not sell personal data to any third party.
            </p>
          </section>

          <section>
            <h2>Data retention</h2>
            <p>
              Anonymous usage data is retained by our analytics provider for up
              to 14 months. Anonymous Firebase Auth IDs are retained as long as
              they remain active in your browser; clearing site data removes them.
            </p>
          </section>

          <section>
            <h2>Your rights</h2>
            <p>
              Depending on where you live, you may have the right to access,
              correct, delete, or restrict processing of your personal data, or
              to object to processing and request data portability (GDPR/UK
              GDPR). California residents have additional rights under the CCPA,
              including the right to know what information is collected and to
              opt out of its sale or sharing &mdash; we do not sell or share
              personal information as defined by the CCPA.
            </p>
            <p>
              To exercise any right, email us at{' '}
              <a href="mailto:acloudbrew@proton.me">acloudbrew@proton.me</a>.
            </p>
          </section>

          <section>
            <h2>Children</h2>
            <p>
              The Service is not directed to children under 13, and we do not
              knowingly collect personal data from them. If you believe a child
              has provided us data, contact us and we will delete it.
            </p>
          </section>

          <section>
            <h2>International transfers</h2>
            <p>
              Our providers may process data in the United States and other
              countries. Where required, transfers are protected by Standard
              Contractual Clauses or equivalent safeguards.
            </p>
          </section>

          <section>
            <h2>Changes</h2>
            <p>
              We may update this policy as the Service evolves. Material changes
              will be highlighted on this page; the &ldquo;Last updated&rdquo;
              date above always reflects the current version.
            </p>
          </section>

          <section>
            <h2>Contact</h2>
            <p>
              Questions? Reach us at{' '}
              <a href="mailto:acloudbrew@proton.me">acloudbrew@proton.me</a>.
            </p>
          </section>
        </article>
      </div>
      <Footer />
    </div>
  )
}
