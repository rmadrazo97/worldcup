import { useNavigate } from 'react-router-dom'
import Header from '../components/Header.jsx'
import MatchDetail from '../components/MatchDetail.jsx'
import Footer from '../components/Footer.jsx'

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
