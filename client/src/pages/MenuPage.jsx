import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import AnswerSheet from '../components/AnswerSheet'
import Caption from '../components/Caption'
import { BackIcon } from '../components/Icons'
import useScans from '../hooks/useScans'
import usePageHeading from '../hooks/usePageHeading'
import useSettings from '../hooks/useSettings'
import useVoice from '../hooks/useVoice'
import { api } from '../lib/api'
import { buzz, canListen, earcon, listen } from '../lib/speech'
import { readAloudText } from '../lib/spoken'

const ASK_TIMEOUT_MS = 30_000 // longest we'll wait for an answer

// "/menu/:id": one scanned menu. The dishes are listed as cards (each with
// Read / Describe / Ask). Describe, Ask, and the pinned "Ask about the menu"
// button open the answer modal (AnswerSheet); Read just speaks, no modal.
export default function MenuPage() {
  const { id } = useParams()
  const { getScan } = useScans()
  const scan = getScan(id)
  const heading = usePageHeading(scan?.name ?? "Menu not found")

  if (!scan) {
    return (
      <main className="flow-screen">
        <h1 ref={heading} tabIndex={-1}>Menu not found</h1>
        <p className="muted">It may have been removed from this device.</p>
        <Link to="/" className="big-button">Back to scanning</Link>
      </main>
    )
  }
  // key: switching between menus starts a fresh conversation
  return <MenuSession key={scan.id} scan={scan} heading={heading} />
}

function MenuSession({ scan, heading }) {
  const { allergies, language, screenReader } = useSettings()
  const { caption, setCaption, say, stop, speaking, speechLang } = useVoice()
  const [phase, setPhase] = useState("ready")
  // the answer modal: null = closed, otherwise { title, dish } where dish is
  // the dish follow-up questions are about (null = the whole menu)
  const [sheet, setSheet] = useState(null)
  // earlier questions + answers; sent with each question so follow-ups work
  const [history, setHistory] = useState([])

  const listening = useRef(null)
  // bumped every time the modal closes; an answer that arrives for an older
  // number was for a modal the user already closed, so it's ignored
  const session = useRef(0)

  // read the overview when the menu opens ("This menu has 3 sections...")
  useEffect(() => {
    say(scan.overviewSpeech)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per menu
  }, [scan.id])

  // soft ticking while waiting on the server
  useEffect(() => {
    if (phase !== "thinking") return
    const timer = setInterval(earcon.tick, 900)
    return () => clearInterval(timer)
  }, [phase])

  function fail(message) {
    earcon.error()
    buzz(200)
    say(message)
  }

  function openSheet(title, dish = null) {
    setSheet({ title, dish })
  }

  // the X, Esc, or a tap outside the modal
  function closeSheet() {
    session.current++          // ignore any answer still on its way
    listening.current?.cancel() // stop the mic without sending a half question
    stop()                     // stop reading aloud
    setPhase("ready")
    setCaption("")             // don't leave the old question behind
    setSheet(null)
  }

  // "Is it spicy?" asked from the Pad Thai card becomes "About the Pad Thai: Is it spicy?"
  // so Gemini knows which dish "it" is. `dish` is also sent on its own, so the
  // server can add that dish's allergy alert itself (Gemini got it wrong sometimes).
  async function ask(question, dish = null) {
    const mine = session.current
    const named = dish && question.toLowerCase().includes(dish.toLowerCase())
    const full = dish && !named ? `About the ${dish}: ${question}` : question
    setPhase("thinking")
    setCaption(`You asked: ${full}`)
    try {
      // the server keeps nothing, so the menu and conversation travel with each question
      const data = await api("/ask", {
        method: "POST",
        // language: Gemini answers in it, and the server writes the allergy alerts in it
        body: JSON.stringify({ menu: scan.menu, question: full, dish, allergies, history, language }),
        // give up after 30s (bad Wi-Fi, server asleep) instead of waiting forever
        signal: AbortSignal.timeout(ASK_TIMEOUT_MS),
      })
      if (mine !== session.current) return // modal was closed while we waited
      setHistory((h) => [...h, { question: full, speech: data.speech }].slice(-4))
      setPhase("ready")
      say(data.speech)
    } catch (err) {
      if (mine !== session.current) return
      setPhase("ready")
      fail(err.name === "TimeoutError" ? "That took too long. Check your connection and try again." : err.message)
    }
  }

  async function startListening(dish = null) {
    const mine = session.current
    stop()
    earcon.listen()
    buzz()
    setPhase("listening")
    setCaption(dish ? `Listening for your question about the ${dish}…` : "Listening…")
    try {
      // listen in the user's language; show their words live as they talk.
      // Not in screen-reader mode: the caption is a live region there, and
      // VoiceOver would read out every half-finished word.
      listening.current = listen(speechLang, {
        onPartial: screenReader ? undefined : (words) => setCaption(`“${words}”`),
      })
      const question = await listening.current.promise
      earcon.stop()
      await ask(question, dish)
    } catch (err) {
      if (mine !== session.current) return // the modal was closed: nothing to show
      setPhase("ready") // always leave the button usable, even after a cancel
      if (err.cancelled) return
      fail(err.message)
    } finally {
      listening.current = null
    }
  }

  // ----- buttons that open the modal -----

  // pinned "Ask about the menu" button
  // Opening the modal doesn't start the mic: the user taps "Start talking"
  // when they're ready (a toggle). Starting it automatically meant it often
  // timed out before they began, or picked up the app's own sounds.
  function askAboutMenu() {
    stop()
    openSheet("Your question")
    setCaption(canListen
      ? "Tap Start talking, ask your question, then tap again to send it."
      : "Type your question below.")
  }

  function describeItem(item) {
    stop()
    openSheet(item.name, item.name)
    ask(`Describe the ${item.name}`, item.name)
  }

  function askAboutItem(item) {
    stop()
    openSheet(item.name, item.name)
    setCaption(canListen
      ? `Tap Start talking and ask about the ${item.name}, then tap again to send it.`
      : `Type your question about the ${item.name} below.`)
  }

  // the modal's toggle: first tap starts listening, second tap sends
  function onSheetMainButton() {
    if (phase === "listening") {
      // done talking: send what was heard. Switch the button right away so
      // the tap visibly registered, even while the phone finishes up.
      setPhase("thinking")
      return listening.current?.stop()
    }
    if (phase === "ready") startListening(sheet?.dish)
  }

  // Read doesn't open the modal: it just speaks (instant, no server call)
  function readItem(item) {
    say(readAloudText(item, allergies, language))
  }

  return (
    <main className="menu-screen">
      <header className="menu-bar">
        <Link to="/" className="back-link">
          <BackIcon size={24} />
          <span>Scans</span>
        </Link>
        <h1 ref={heading} tabIndex={-1}>{scan.name}</h1>
      </header>

      {scan.mock && <p className="notice">Mock mode: no GEMINI_API_KEY is set, so this is a sample menu.</p>}

      {/* screen readers still need to hear Read and the overview while the modal
          is closed; while it's open, the modal's own caption does this job
          (a modal hides everything behind it from screen readers) */}
      {!sheet && <Caption text={caption} className="visually-hidden" />}

        <MenuList
          menu={scan.menu}
          allergies={allergies}
          language={language}
          onRead={readItem}
          onDescribe={describeItem}
          onAsk={askAboutItem}
        />
  

      {/* pinned to the bottom: always one tap away, wherever you've scrolled */}
      <div className="ask-bar">
        <button className="main-button" onClick={askAboutMenu}>Ask about the menu</button>
      </div>

      <AnswerSheet
        open={!!sheet}
        title={sheet?.title ?? ""}
        caption={caption}
        phase={phase}
        speaking={speaking}
        canListen={canListen}
        onClose={closeSheet}
        onRepeat={() => say(caption)}
        onMainButton={onSheetMainButton}
        onTypedQuestion={(question) => { stop(); ask(question, sheet?.dish) }}
      />
    </main>
  )
}

// true when the translated name is actually different ("Bruschetta" often isn't)
const renamed = (item) => item.name_translated && item.name_translated.toLowerCase() !== item.name.toLowerCase()

// a section's heading in the reader's language (items carry the translation)
function sectionLabel(menu, section) {
  return menu.items.find((i) => i.section === section && i.section_translated)?.section_translated || section
}

// the large-text menu, one card per dish
function MenuList({ menu, allergies, language, onRead, onDescribe, onAsk }) {
  return (
    <div className="menu-list">
      {menu.sections.map((section) => (
        <section key={section}>
          <h2 dir="auto">{sectionLabel(menu, section)}</h2>
          <ul className="items">
            {menu.items.filter((item) => item.section === section).map((item, i) => {
              const avoid = item.contains.filter((a) => allergies.includes(a))
              const ask = item.possibly_contains.filter((a) => allergies.includes(a))
              return (
                <li key={`${item.name}-${i}`} className={avoid.length ? "item avoid" : "item"}>
                  <div className="item-head">
                    {/* translated name first (lang/dir for screen readers and Arabic),
                        then the name as printed, so you can order it */}
                    <span lang={item.name_translated ? language : undefined} dir="auto">
                      {item.name_translated || item.name}
                    </span>
                    <span>{item.price == null ? "price not listed" : `$${item.price}`}</span>
                  </div>
                  {renamed(item) && <p className="original-name" dir="auto">On the menu: {item.name}</p>}
                  {(item.description_translated || item.description) && (
                    <p className="muted" lang={item.description_translated ? language : undefined} dir="auto">
                      {item.description_translated || item.description}
                    </p>
                  )}
                  {/* words, not just color, so the warning works for everyone */}
                  {avoid.length > 0 && <p className="tag-avoid">Avoid: contains {avoid.join(", ")}</p>}
                  {ask.length > 0 && <p className="tag-ask">Ask: may contain {ask.join(", ")}</p>}

                  {/* aria-labels include the dish name; otherwise a screen reader
                      hears "Read, Describe, Ask" over and over with no way to tell cards apart */}
                  <div className="item-actions">
                    <button onClick={() => onRead(item)} aria-label={`Read ${item.name}`}>Read</button>
                    <button onClick={() => onDescribe(item)} aria-label={`Describe ${item.name}`}>Describe</button>
                    <button onClick={() => onAsk(item)} aria-label={`Ask about ${item.name}`}>Ask</button>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
