import { useState } from 'react'
import { SettingsContext } from './contexts'
import { deviceLanguage } from '../lib/languages'
import { load, save } from '../lib/storage'

// User preferences every screen needs: allergies (home summary, nav badge,
// menu stats, /api/ask), screen-reader mode (how answers are read out), and
// language (what menus and answers are translated into).
//
// Saved on this device for now. When the "build my profile" feature lands,
// this is the one place to change: load from / save to the user's account
// instead of (or as well as) localStorage, and every screen keeps working.
export default function SettingsProvider({ children }) {
  const [allergies, setAllergies] = useState(() => load("allergies", []))
  // null = we haven't asked yet, so the app shows the welcome screen first
  const [screenReader, setScreenReaderState] = useState(() => load("screenReader", null))
  // a code from lib/languages.js, e.g. "es"; starts as the phone's language
  const [language, setLanguageState] = useState(() => load("language", deviceLanguage()))

  function toggleAllergy(name) {
    const next = allergies.includes(name) ? allergies.filter((a) => a !== name) : [...allergies, name]
    setAllergies(next)
    save("allergies", next)
  }

  function setScreenReader(uses) {
    setScreenReaderState(uses)
    save("screenReader", uses)
  }

  function setLanguage(code) {
    setLanguageState(code)
    save("language", code)
  }

  const value = { allergies, toggleAllergy, screenReader, setScreenReader, language, setLanguage }
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}
