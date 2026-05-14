import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'
import { initClient } from './api/client.js'
import { SeasonProvider, TeamsProvider } from './api/providers.jsx'
import './styles.css'

initClient()
registerSW({ immediate: true })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <SeasonProvider>
        <TeamsProvider>
          <App />
        </TeamsProvider>
      </SeasonProvider>
    </BrowserRouter>
  </StrictMode>,
)
