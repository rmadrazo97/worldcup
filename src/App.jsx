import { Routes, Route, Navigate } from 'react-router-dom'
import MainFeed from './pages/MainFeed.jsx'
import GroupDetailPage from './pages/GroupDetailPage.jsx'
import MatchDetailPage from './pages/MatchDetailPage.jsx'
import { usePageViews } from './api/analytics.js'

export default function App() {
  usePageViews()
  return (
    <Routes>
      <Route path="/" element={<MainFeed />} />
      <Route path="/group/:groupId" element={<GroupDetailPage />} />
      <Route path="/match/:matchId" element={<MatchDetailPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
