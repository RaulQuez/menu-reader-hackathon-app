import { useContext } from 'react'
import { SettingsContext } from '../context/contexts'

// const { allergies, toggleAllergy, screenReader, setScreenReader, language, setLanguage } = useSettings()
export default function useSettings() {
  const settings = useContext(SettingsContext)
  if (!settings) throw new Error("useSettings must be used inside <SettingsProvider>")
  return settings
}
