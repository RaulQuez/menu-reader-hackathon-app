// The languages a menu and its answers can be translated into.
// Must match LANGUAGES in server/i18n.py (the server ignores codes it doesn't know).
//
// speech: the voice/microphone locale for speechSynthesis + SpeechRecognition.
// Only the menu and answers are translated for now; the app's own buttons
// and headings stay in English.
export const LANGUAGES = [
  { code: "en", name: "English", native: "English", speech: "en-US" },
  { code: "es", name: "Spanish", native: "Español", speech: "es-ES" },
  { code: "fr", name: "French", native: "Français", speech: "fr-FR" },
  { code: "zh", name: "Chinese", native: "中文", speech: "zh-CN" },
  { code: "ar", name: "Arabic", native: "العربية", speech: "ar-SA" }, // right to left
]

export const languageInfo = (code) => LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0]

// first launch: use the phone's language if we support it, else English
export function deviceLanguage() {
  const code = (navigator.language || "en").slice(0, 2).toLowerCase()
  return languageInfo(code).code
}
