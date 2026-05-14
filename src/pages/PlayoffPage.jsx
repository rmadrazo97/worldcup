import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMatches } from '../api/scores.js'
import Header from '../components/Header.jsx'
import Footer from '../components/Footer.jsx'
import PlayoffBracket from '../components/PlayoffBracket.jsx'

const KNOCKOUT_STAGES = new Set(['r32', 'r16', 'qf', 'sf', 'final', 'third_place'])

export default function PlayoffPage() {
  const navigate = useNavigate()
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    getMatches()
      .then((all) => {
        if (!alive) return
        setMatches((all || []).filter((m) => KNOCKOUT_STAGES.has(m.stage)))
        setLoading(false)
      })
      .catch((e) => {
        if (!alive) return
        setError(e)
        setLoading(false)
      })
    return () => { alive = false }
  }, [])

  return (
    <div className="app">
      <Header
        view="detail"
        onBack={() => navigate('/')}
        searchOpen={searchOpen}
        setSearchOpen={setSearchOpen}
        query={query}
        onQuery={setQuery}
      />

      <div className="shell bracket-shell">
        <div className="bracket-intro">
          <div className="bracket-intro-eyebrow">Knockout stage · FIFA World Cup 2026</div>
          <h1 className="bracket-intro-title">Playoffs</h1>
          <div className="bracket-intro-sub">
            Swipe through the rounds — single elimination from 32 to 1.
          </div>
        </div>

        {error ? (
          <div className="empty">
            <div className="empty-title">Couldn't load knockout matches</div>
            <div className="empty-sub">Showing structure only.</div>
            <div style={{ marginTop: 16 }}>
              <PlayoffBracket matches={[]} />
            </div>
          </div>
        ) : (
          <PlayoffBracket matches={loading ? [] : matches} />
        )}
      </div>

      <Footer />
    </div>
  )
}
