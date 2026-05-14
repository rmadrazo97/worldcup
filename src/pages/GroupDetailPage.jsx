import { useNavigate } from 'react-router-dom'
import Header from '../components/Header.jsx'
import GroupDetail from '../components/GroupDetail.jsx'
import Footer from '../components/Footer.jsx'

export default function GroupDetailPage() {
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
      <GroupDetail />
      <Footer />
    </div>
  )
}
