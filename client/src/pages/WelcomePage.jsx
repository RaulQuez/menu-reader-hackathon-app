import { useNavigate } from 'react-router'
import usePageHeading from '../hooks/usePageHeading'
import useSettings from '../hooks/useSettings'
import { speak } from '../lib/speech'

// "/welcome": shown once, on first launch. The answer decides whether the app
// speaks for itself or leaves reading to the user's own screen reader.
export default function WelcomePage() {
  const heading = usePageHeading("Welcome")
  const navigate = useNavigate()
  const { setScreenReader } = useSettings()

  function choose(uses) {
    setScreenReader(uses)
    // speaking inside this tap also unlocks audio on iPhones
    if (!uses) speak("Welcome to Menu Reader. Tap Scan a menu to get started.")
    navigate("/", { replace: true })
  }

  return (
    <main className="flow-screen">
      <h1 ref={heading} tabIndex={-1}>Menu Reader</h1>
      <p className="muted">Take a photo of a menu, then ask about it out loud.</p>
      <h2>Do you use a screen reader, like VoiceOver or TalkBack?</h2>
      <button className="big-button" onClick={() => choose(true)}>Yes, I use a screen reader</button>
      <button className="big-button secondary" onClick={() => choose(false)}>No, read answers aloud for me</button>
    </main>
  )
}
