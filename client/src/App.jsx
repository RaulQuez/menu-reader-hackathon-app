import { Navigate, Route, Routes } from 'react-router'
import TabLayout from './components/TabLayout'
import HomePage from './pages/HomePage'
import MenuPage from './pages/MenuPage'
import ReadingPage from './pages/ReadingPage'
import SettingsPage from './pages/SettingsPage'
import WelcomePage from './pages/WelcomePage'
import './App.css'

// Every screen in the app and its URL.
//
// Tab pages (Scan, Settings) sit inside <TabLayout>, which adds the bottom nav.
// Flow screens (welcome, reading, menu) are full screen with no nav, because
// while you're reading a menu at the table the whole screen is for asking.
//
// Flask's catch-all route serves index.html for any path, so all of these
// URLs also work after a refresh or when deployed.
export default function App() {
  return (
    <Routes>
      <Route element={<TabLayout />}>
        <Route index element={<HomePage />} />
        <Route path="settings" element={<SettingsPage />} />
        {/* the tab used to be called Allergies; keep old links working */}
        <Route path="allergies" element={<Navigate to="/settings" replace />} />
      </Route>

      <Route path="welcome" element={<WelcomePage />} />
      <Route path="reading" element={<ReadingPage />} />
      <Route path="menu/:id" element={<MenuPage />} />

      {/* unknown URL: go home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
