import { useEffect, useState } from 'react'
import { languageInfo } from '../lib/languages'
import { speak, stopSpeaking } from '../lib/speech'
import useSettings from './useSettings'

// Talking to the user, respecting screen-reader mode:
// - screen-reader users: we put the text in an aria-live caption and let
//   VoiceOver/TalkBack read it (their voice, their speed, no double-talking)
// - everyone else: the app speaks it with speechSynthesis
//
// const { caption, say, stop, speaking } = useVoice()  +  <Caption text={caption} />
export default function useVoice() {
  const { screenReader, language } = useSettings()
  const speechLang = languageInfo(language).speech // e.g. "es-ES": speak with a Spanish voice
  const [caption, setCaption] = useState("")
  const [speaking, setSpeaking] = useState(false)

  // leaving the screen stops any speech that screen started
  useEffect(() => stopSpeaking, [])

  function say(text) {
    if (screenReader) {
      // clear first so the screen reader re-announces even identical text ("Repeat")
      setCaption("")
      setTimeout(() => setCaption(text), 50)
      return
    }
    setCaption(text)
    setSpeaking(true)
    speak(text, { lang: speechLang, onEnd: () => setSpeaking(false) })
  }

  function stop() {
    stopSpeaking()
    setSpeaking(false)
  }

  return { caption, setCaption, say, stop, speaking, speechLang }
}
