import useSettings from '../hooks/useSettings'

// The large text of whatever the app last said. In screen-reader mode it's an
// aria-live region, so VoiceOver/TalkBack read each new caption automatically.
// live={false} for a second, visible copy of the same text, so it isn't read twice.
export default function Caption({ text, live = true, className = "caption" }) {
  const { screenReader, language } = useSettings()
  // lang: screen readers use the right accent; dir="auto": Arabic lays out right to left
  return (
    <p className={className} lang={language} dir="auto" aria-live={live && screenReader ? "polite" : "off"}>
      {text}
    </p>
  )
}
