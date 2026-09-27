import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import Caption from '../components/Caption'
import useScans from '../hooks/useScans'
import useSettings from '../hooks/useSettings'
import usePageHeading from '../hooks/usePageHeading'
import useVoice from '../hooks/useVoice'
import { api } from '../lib/api'
import { earcon } from '../lib/speech'

// "/reading": uploads the chosen photos and waits for the menu to be parsed.
// Full screen with no nav bar: there's nothing to do but wait (or retake).
export default function ReadingPage() {
  const heading = usePageHeading("Reading your menu")
  const { state } = useLocation()
  const navigate = useNavigate()
  const { addScan } = useScans()
  const { language } = useSettings()
  const { caption, say } = useVoice()
  const [failed, setFailed] = useState(false)

  // React's StrictMode runs effects twice in development. Refs survive that,
  // so this makes sure we only upload once.
  const started = useRef(false)
  const files = state?.files

  useEffect(() => {
    if (!files?.length) return
    // said before the guard: StrictMode's fake unmount stops speech, so the
    // second run has to start it again (speaking twice just restarts it)
    say("Reading your menu. This takes a few seconds.")
    if (started.current) return
    started.current = true

    // soft ticking while we wait, so silence never feels like a crash
    const ticking = setInterval(earcon.tick, 900)

    const form = new FormData()
    files.forEach((file) => form.append("images", file))
    form.append("language", language) // Gemini translates the menu while reading it

    api("/parse", { method: "POST", body: form })
      .then((data) => {
        if (!data.menu.items.length) throw new Error(data.overview_speech) // the retake tips
        const id = addScan({
          menu: data.menu,
          pages: data.pages,
          overviewSpeech: data.overview_speech,
          mock: data.mock,
        })
        // replace: pressing back from the menu goes home, not back to this screen
        navigate(`/menu/${id}`, { replace: true })
      })
      .catch((err) => {
        earcon.error()
        setFailed(true)
        say(err.message)
      })
      .finally(() => clearInterval(ticking))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per visit
  }, [])

  // opened directly (e.g. page refreshed): the photos are gone, so start over
  if (!files?.length) return <Navigate to="/" replace />

  return (
    <main className="flow-screen" aria-busy={!failed}>
      <h1 ref={heading} tabIndex={-1}>{failed ? "Couldn't read the menu" : "Reading your menu…"}</h1>
      {!failed && <div className="spinner" aria-hidden="true" />}
      <Caption text={caption} />
      {failed && <Link to="/" replace className="big-button">Try again</Link>}
    </main>
  )
}
