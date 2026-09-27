import { useEffect, useState } from 'react'
import usePageHeading from '../hooks/usePageHeading'
import useSettings from '../hooks/useSettings'
import { ALLERGENS } from '../lib/allergens'
import { LANGUAGES, languageInfo } from '../lib/languages'
import { voiceFor } from '../lib/speech'

// The Settings tab ("/settings"): language, allergies, and the screen-reader
// setting, all in one place. Changes save instantly (no Save button to forget).
export default function SettingsPage() {
  const heading = usePageHeading("Settings")
  const { allergies, toggleAllergy, screenReader, setScreenReader, language, setLanguage } = useSettings()
  const hasVoice = useHasVoice(languageInfo(language).speech)

  return (
    <main className="tab-page">
      <h1 ref={heading} tabIndex={-1}>Settings</h1>

      <section className="settings-section" aria-labelledby="language-heading">
        <h2 id="language-heading">Language</h2>
        <p className="muted">Menus and answers are translated into this language. Dish names keep their original too, so you can order.</p>

        {/* radio buttons: one choice, and screen readers announce "1 of 5" */}
        <fieldset className="checks">
          <legend className="visually-hidden">Language</legend>
          {LANGUAGES.map((l) => (
            <label key={l.code} className="check">
              <input type="radio" name="language" checked={language === l.code} onChange={() => setLanguage(l.code)} />
              {/* lang + dir so each name is read with the right accent and direction */}
              <span lang={l.code} dir="auto">{l.native}</span>
              {l.native !== l.name && <span className="muted">{l.name}</span>}
            </label>
          ))}
        </fieldset>

        {!hasVoice && (
          <p className="notice">
            This phone doesn't have a {languageInfo(language).name} voice installed, so answers may be read
            in the wrong accent. You can add one in your phone's text-to-speech settings. The text on screen is always translated.
          </p>
        )}
      </section>

      <section className="settings-section" aria-labelledby="allergies-heading">
        <h2 id="allergies-heading">Your allergies</h2>
        <p className="muted">
          Dishes that list these are left out of answers. Dishes that might contain them come with a warning.
        </p>
        <p className="notice">Menus don't list every ingredient. Always confirm with your server.</p>

        <fieldset className="checks">
          <legend className="visually-hidden">Allergies</legend>
          {ALLERGENS.map((name) => (
            <label key={name} className="check">
              <input type="checkbox" checked={allergies.includes(name)} onChange={() => toggleAllergy(name)} />
              {name}
            </label>
          ))}
        </fieldset>
      </section>

      <section className="settings-section" aria-labelledby="reading-heading">
        <h2 id="reading-heading">Reading answers</h2>
        <label className="check">
          <input type="checkbox" checked={!!screenReader} onChange={(e) => setScreenReader(e.target.checked)} />
          I use a screen reader, so don't speak over it
        </label>
      </section>
    </main>
  )
}

// true if this device has a voice for the locale. The voice list loads
// in the background, so re-check when the browser says it changed.
function useHasVoice(lang) {
  const [has, setHas] = useState(true) // assume yes until we know, so there's no flash of the warning
  useEffect(() => {
    if (!("speechSynthesis" in window)) return
    const check = () => {
      if (window.speechSynthesis.getVoices().length) setHas(Boolean(voiceFor(lang)))
    }
    check()
    window.speechSynthesis.addEventListener("voiceschanged", check)
    return () => window.speechSynthesis.removeEventListener("voiceschanged", check)
  }, [lang])
  return has
}
