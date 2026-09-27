import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import ScansProvider from './context/ScansProvider'
import SettingsProvider from './context/SettingsProvider'
import './theme/tokens.css'
import App from './App.jsx'

// Providers wrap the whole app so any screen can use useSettings() / useScans().
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <SettingsProvider>
        <ScansProvider>
          <App />
        </ScansProvider>
      </SettingsProvider>
    </BrowserRouter>
  </StrictMode>,
)
