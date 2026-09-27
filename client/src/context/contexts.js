import { createContext } from 'react'

// The shared "boxes" of app-wide state. Providers fill them (context/*Provider.jsx)
// and hooks read them (hooks/useSettings.js, hooks/useScans.js). They live in
// their own file so Vite's hot reload keeps working (it wants component files
// to export only components).
export const SettingsContext = createContext(null)
export const ScansContext = createContext(null)
