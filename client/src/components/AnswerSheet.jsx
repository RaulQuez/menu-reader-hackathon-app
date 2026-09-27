import { useState } from 'react'
import useModalDialog from '../hooks/useModalDialog'
import Caption from './Caption'
import { CloseIcon } from './Icons'
import VoiceDebugLog from './VoiceDebugLog'

// the big button's label for each phase: ready -> listening -> thinking -> ready
// It's a toggle: tap to start talking, tap again to send.
const ACTION_LABELS = {
  ready: "🎤 Start talking",
  listening: "■ Stop and send",
  thinking: "Looking that up…",
}

// The answer modal: slides up from the bottom when you tap Describe or Ask,
// shows the answer, and closes with the X (or Esc, or tapping outside).
//
// The <dialog> behaviour lives in useModalDialog.
// This component only displays things; MenuPage owns the state and passes in
// what to show and what to call.
export default function AnswerSheet({
  open,          // show or hide
  title,         // dish name, or "Your question"
  caption,       // the answer / status text
  phase,         // "ready" | "listening" | "thinking"
  speaking,      // app is currently reading the answer aloud
  canListen,     // browser has speech recognition
  onClose,
  onRepeat,
  onMainButton,  // start listening / stop listening
  onTypedQuestion, // (text) => void
}) {
  const dialogProps = useModalDialog(open, onClose)
  const [typed, setTyped] = useState("")

  function submit(e) {
    e.preventDefault()
    const question = typed.trim()
    if (!question || phase !== "ready") return
    setTyped("")
    onTypedQuestion(question)
  }

  const busy = phase === "thinking"

  return (
    <dialog {...dialogProps} className="answer-sheet" aria-labelledby="sheet-title">
      <div className="sheet-body">
        <div className="sheet-header">
          <h2 id="sheet-title">{title}</h2>
          <button className="sheet-close" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        {/* only rendered while open, so it's the one live region screen readers hear */}
        {open && <Caption text={caption} className="caption sheet-caption" />}

        <div className="sheet-actions">
          {caption && phase === "ready" && (
            <button className="sheet-repeat" onClick={onRepeat}>Repeat</button>
          )}
          {canListen && (
            <button className={`main-button ${phase}`} onClick={onMainButton} disabled={busy} aria-busy={busy}>
              {phase === "ready" && speaking ? "🎤 Interrupt and talk" : ACTION_LABELS[phase]}
            </button>
          )}
        </div>

        {/* development only (npm run dev / dev:phone): what the mic is doing */}
        {import.meta.env.DEV && canListen && <VoiceDebugLog />}

        {/* typing works too (and is the only way in browsers without speech recognition) */}
        <form className="ask" onSubmit={submit}>
          <label htmlFor="sheet-question">Or type a question</label>
          <div className="row">
            <input
              id="sheet-question"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Is it spicy?"
              autoComplete="off"
            />
            <button type="submit" disabled={phase !== "ready"}>Ask</button>
          </div>
        </form>
      </div>
    </dialog>
  )
}
