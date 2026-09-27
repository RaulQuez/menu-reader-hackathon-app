import { useEffect, useState } from 'react'
import { onVoiceLog, voiceLog } from '../lib/speech'

// DEVELOPMENT ONLY: the voice steps from speech.js, shown on screen so we can
// see what a phone's speech recognizer actually does without plugging it into
// a computer. Collapsed by default; "Copy" puts the whole log on the clipboard
// to paste into a message. Rendered only when import.meta.env.DEV is true.
export default function VoiceDebugLog() {
  const [lines, setLines] = useState(() => [...voiceLog])
  const [copied, setCopied] = useState(false)

  // re-render whenever speech.js records a new step
  useEffect(() => onVoiceLog(() => setLines([...voiceLog])), [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(lines.join("\n"))
      setCopied(true)
    } catch {
      setCopied(false) // clipboard blocked: the text can still be selected by hand
    }
  }

  return (
    <details className="voice-debug">
      <summary>Voice debug log ({lines.length})</summary>
      <button type="button" onClick={copy}>{copied ? "Copied" : "Copy log"}</button>
      <pre>{lines.slice(-15).join("\n") || "Nothing yet: tap Start talking."}</pre>
    </details>
  )
}
