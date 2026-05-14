import { useNavigate } from 'react-router-dom'
import Header from '../components/Header.jsx'
import MatchDetail from '../components/MatchDetail.jsx'

export default function MatchDetailPage() {
  const navigate = useNavigate()
  return (
    <div className="app">
      <Header
        view="detail"
        onBack={() => navigate(-1)}
        searchOpen={false}
        setSearchOpen={() => {}}
        query=""
        onQuery={() => {}}
      />
      <MatchDetail />
      <Footer />
    </div>
  )
}

function Footer() {
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
      </div>
    </footer>
  )
}
