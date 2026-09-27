// Browser speech + sound helpers. Everything here is free and on-device:
// speechSynthesis (text-to-speech), webkitSpeechRecognition (speech-to-text),
// and Web Audio tones ("earcons") so users hear what state the app is in.

// The speech-to-text recognizer. Newer browsers call it SpeechRecognition;
// Safari and older Chrome only have the prefixed webkitSpeechRecognition.
// Careful: SpeechRecognitionEvent is a different thing (the result message a
// recognizer sends to onresult). It can't be created with `new` and has no
// start(), so using it here makes every voice question fail.
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
export const canListen = Boolean(Recognition);

// Joke/novelty voices that come with Apple devices. They're installed on
// most iPhones and Macs, so without this list one could get picked.
// A Set because we only ever ask "is this name in the list?" (.has is fast).
const NOVELTY_VOICES = new Set([
  "Albert", "Bad News", "Bahh", "Bells", "Boing", "Bubbles", "Cellos", "Fred",
  "Good News", "Jester", "Junior", "Organ", "Ralph", "Superstar", "Trinoids",
  "Whisper", "Wobble", "Zarvox",
]);

// How good ONE voice is for a language, as a number (higher = better).
// voice: one entry from speechSynthesis.getVoices(), e.g. { name: "Samantha (Enhanced)", lang: "en-US" }
// lang: the locale we want, e.g. "en-US"
function scoreVoice(voice, lang){
  let score = 0;

  // exact locale ("es-ES") beats the same language from elsewhere ("es-MX"),
  // but only by a little: a much better-sounding voice should still win
  if (voice.lang === lang) score += 2;

   // the downloadable high-quality voices put this in their names,
  // e.g. "Samantha (Enhanced)", "Daniel (Premium)", "... Natural"
  if (/premium|enhanced|natural|neural/i.test(voice.name)) score += 5;

  // Chrome's online "Google ..." voices sound better than most built-in ones
  if (/google/i.test(voice.name)) score += 3;

  // push joke voices and low-quality "compact" ones to the bottom
  if (NOVELTY_VOICES.has(voice.name) || /compact/i.test(voice.name)) score -= 10;

  return score; // always a number, so the sort below can compare scores
}
// a voice installed on this device for a locale like "es-ES" (or null).
// Phones don't all have every language, e.g. Arabic is often missing.
export function voiceFor(lang) {
  if (!("speechSynthesis" in window)) return null;
  const base = lang.slice(0, 2); // "es-ES" -> es

  const candidates = 
  window.speechSynthesis.getVoices().filter((v) =>
  v.lang.startsWith(base));

  // sort best first: (b - a) is positive when b scores higher, which moves b
  // ahead of a. Then take the first one, or null if there were non
  return candidates.sort((a,b) => scoreVoice(b, lang) - scoreVoice(a, lang))[0] ?? null;
}

// After cancelling speech, how long to wait before speaking again. Phone
// browsers (iOS Safari, Android Chrome) can silently drop an utterance that's
// queued in the same instant as a cancel().
const AFTER_CANCEL_MS = 120;

// lang: e.g. "es-ES", so Spanish text is spoken with a Spanish voice
export function speak(text, { onEnd, lang = "en-US" } = {}) {
  if (!("speechSynthesis" in window)) return onEnd?.();
  const synth = window.speechSynthesis;

  // only cancel if something is actually playing or queued
  const wasBusy = synth.speaking || synth.pending;
  if (wasBusy) synth.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.voice = voiceFor(lang); // null = let the browser pick
  utterance.rate = 1;
  utterance.onstart = () => debug("speaking");
  utterance.onend = () => { debug("speech ended"); onEnd?.(); };
  utterance.onerror = (e) => {
    // "interrupted"/"canceled" = something newer was said instead (normal).
    // "not-allowed" = the phone blocked speech that didn't start from a tap.
    if (e.error === "interrupted" || e.error === "canceled") debug("speech replaced by newer speech");
    else debug("speech error:", e.error);
    onEnd?.();
  };

  const go = () => {
    debug("speak:", JSON.stringify(text.slice(0, 40)), lang, "voice:", utterance.voice?.name ?? "default");
    synth.resume(); // Chrome can get stuck "paused" after the tab was in the background
    synth.speak(utterance);
  };
  if (wasBusy) setTimeout(go, AFTER_CANCEL_MS);
  else go();
}

export function stopSpeaking() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

const LISTEN_ERRORS = {
  "no-speech": "I didn't hear anything. Tap and try again.",
  "not-allowed": "The microphone is blocked. Allow microphone access, or type your question.",
  "audio-capture": "I couldn't find a microphone. You can type your question instead.",
  network: "Speech recognition needs an internet connection. You can type your question instead.",
};

// While developing, record each step of listening so if voice fails on a
// phone we can see where. It goes to the console AND to an on-screen log in
// the answer modal (VoiceDebugLog), because connecting a phone to a computer
// to read its console is a hassle. Production builds skip all of this.
export const voiceLog = [];            // last few steps, newest last
const logListeners = new Set();        // components showing the log
const started = performance.now();

export function onVoiceLog(listener) { // subscribe; returns an unsubscribe function
  logListeners.add(listener);
  return () => logListeners.delete(listener);
}

const debug = import.meta.env.DEV
  ? (...args) => {
      console.debug("[speech]", ...args);
      const seconds = ((performance.now() - started) / 1000).toFixed(1);
      const text = args.map((a) => (typeof a === "string" ? a : a?.message ?? JSON.stringify(a))).join(" ");
      voiceLog.push(`${seconds}s ${text}`);
      if (voiceLog.length > 40) voiceLog.shift();
      logListeners.forEach((listener) => listener());
    }
  : () => {};

// one line about the device, so a copied log says which phone/browser it was
if (import.meta.env.DEV) debug("device:", navigator.userAgent.replace(/^Mozilla\/5\.0 /, ""));

// How long to wait before opening the mic: long enough for the "your turn"
// tone (0.27s) to finish and for cancelled speech to actually go quiet.
const MIC_DELAY_MS = 350;

// After Stop, how long to wait for the phone to finish the last words before
// sending what we have anyway.
const STOP_GRACE_MS = 800;

let active = null; // the recognizer currently listening (only ever one)

function cancelledError() {
  const error = new Error("Cancelled");
  error.cancelled = true; // cancel() was called: not a real failure
  return error;
}

// Resolves with what the user said. Returns { promise, stop, cancel }:
// stop() = "I'm done talking" (keeps what was heard), cancel() = throw it away.
// lang: which language to listen for, e.g. "fr-FR"
// onPartial(text): called with the words so far while the user is talking,
// so the app can show them live (proof it's hearing you)
//
// It's a toggle: the mic stays on through pauses until stop() is called
// (continuous mode). Without that, phones end listening after a short
// silence, so a pause to think meant your question got cut off or lost.
//
// Why the mic doesn't start instantly: phones share ONE audio system between
// playing and recording. If the mic opens while the app is still speaking or
// playing a tone, it often hears nothing, which is why voice used to work the
// first time (nothing playing yet) and fail after that (an answer had just
// been read out and a tone was playing). So: go quiet first, then listen.
export function listen(lang = "en-US", { onPartial } = {}) {
  let recognition = null;
  let latest = "";        // everything heard so far (finished + still being worked out)
  let settled = false;    // the promise only settles once, whichever way listening ends
  let userCancelled = false; // the X was pressed (vs. the phone reporting "aborted" on its own)
  let settle;             // set below: settle("done" | "cancel" | Error)

  const promise = new Promise((resolve, reject) => {
    // Every way listening can end comes through here: the user taps Stop,
    // the phone reports it's finished, the safety timer fires, an error, or
    // the X. The first one wins; the rest are ignored.
    settle = (how) => {
      if (settled) return;
      settled = true;
      if (active === recognition) active = null;
      if (how === "cancel") reject(cancelledError());
      else if (how instanceof Error) reject(how);
      else if (latest) resolve(latest);
      else reject(new Error(LISTEN_ERRORS["no-speech"]));
    };

    stopSpeaking();

    setTimeout(async () => {
      if (settled) return; // stopped or cancelled before the mic even opened

      active?.abort(); // never two recognizers fighting over the mic
      // pause the tone player: a running AudioContext keeps the phone's audio
      // system in "playback" mode. tone() turns it back on when needed.
      await audio?.suspend().catch(() => {});
      if (settled) return;

      recognition = new Recognition();
      active = recognition;
      recognition.lang = lang;
      recognition.continuous = true;     // keep listening through pauses, until stop
      recognition.interimResults = true; // get words as they're spoken, not just at the end
      recognition.maxAlternatives = 1;

      recognition.onresult = (e) => {
        // e.results holds every phrase heard since start(); each is either
        // final (done) or interim (still being worked out). Rebuild the whole
        // text each time rather than appending, so nothing is counted twice.
        const finals = [];
        let interim = "";
        for (const result of e.results) {
          const text = result[0].transcript.trim();
          if (!result.isFinal) {
            interim += ` ${text}`;
          } else if (finals.length && text.toLowerCase().startsWith(finals.at(-1).toLowerCase())) {
            // Android Chrome sometimes repeats a phrase with more words added
            // ("is it", "is it spicy"); keep only the longer one
            finals[finals.length - 1] = text;
          } else {
            finals.push(text);
          }
        }
        latest = `${finals.join(" ")}${interim}`.trim();
        debug("result:", latest);
        onPartial?.(latest);
      };
      recognition.onnomatch = () => debug("nomatch: heard sound but no words");
      recognition.onerror = (e) => {
        debug("error:", e.error);
        // "aborted" is only a cancel if the X was pressed. Some phones also
        // report "aborted" when you tap Stop; treating that as a cancel used to
        // leave the app stuck on "Looking that up…" with nothing sent.
        if (e.error === "aborted") return settle(userCancelled ? "cancel" : "done");
        // "no-speech" after the user already said something isn't a failure
        if (e.error === "no-speech" && latest) return settle("done");
        settle(new Error(LISTEN_ERRORS[e.error] || "I couldn't hear that. Tap and try again."));
      };
      // the phone says it's finished: after stop, after an error, or on its
      // own (some browsers give up after ~60 seconds)
      recognition.onend = () => {
        debug("end, heard:", JSON.stringify(latest));
        settle("done");
      };
      // these tell us how far it got: did the mic open? did it hear speech?
      for (const step of ["audiostart", "speechstart", "speechend", "audioend"]) {
        recognition.addEventListener(step, () => debug(step));
      }

      try {
        debug("start, lang:", lang);
        recognition.start();
      } catch (err) {
        debug("start failed:", err);
        settle(new Error("I couldn't start listening. Tap and try again."));
      }
    }, MIC_DELAY_MS);
  });

  return {
    promise,
    // "I'm done talking". Ask the phone to finish up, but don't depend on it:
    // some phones never send onend in continuous mode, which left the Stop
    // button doing nothing. After STOP_GRACE_MS we send what we have and
    // force the mic off.
    stop: () => {
      if (!recognition) return settle("done"); // tapped before the mic opened
      debug("stop requested");
      try {
        recognition.stop();
      } catch (err) {
        debug("stop() threw:", err); // some phones throw if it already ended; the timer below still finishes
      }
      setTimeout(() => {
        if (settled) return;
        debug("no onend after stop, finishing anyway");
        const r = recognition;
        settle("done");
        r.abort();
      }, STOP_GRACE_MS);
    },
    // the X: throw away whatever was heard
    cancel: () => {
      userCancelled = true;
      latest = "";
      settle("cancel");
      recognition?.abort();
    },
  };
}

let audio;
function tone(freq, start, duration, volume = 0.15) {
  audio ??= new (window.AudioContext || window.webkitAudioContext)();
  if (audio.state === "suspended") audio.resume(); // paused by listen(); wake it up
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, audio.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + start + duration);
  osc.connect(gain).connect(audio.destination);
  osc.start(audio.currentTime + start);
  osc.stop(audio.currentTime + start + duration);
}

export const earcon = {
  listen: () => { tone(660, 0, 0.12); tone(880, 0.12, 0.15); },   // rising: "your turn"
  stop: () => { tone(880, 0, 0.12); tone(660, 0.12, 0.15); },     // falling: "got it"
  tick: () => tone(520, 0, 0.08, 0.08),                          // repeating while working
  error: () => { tone(300, 0, 0.2); tone(220, 0.2, 0.3); },
};

export function buzz(ms = 30) {
  navigator.vibrate?.(ms); // Android only; iOS ignores it
}

// Phones only let a page make sound (speech or tones) that starts from a tap.
// Once something has been played during a tap, later sounds are allowed too,
// e.g. an answer that's read out after the server replies. So on the first
// tap anywhere after the page loads, "unlock" both: speak a silent utterance
// and wake the tone player. Without this, reopening a saved menu after a
// reload stayed silent on iPhones, because nothing had been spoken in a tap.
function unlockAudio() {
  debug("first tap: unlocking speech and sounds");
  if ("speechSynthesis" in window && !window.speechSynthesis.speaking) {
    const silent = new SpeechSynthesisUtterance(" ");
    silent.volume = 0;
    window.speechSynthesis.speak(silent);
  }
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
  } catch {
    // no Web Audio: tones just won't play
  }
}
// capture: runs before the tapped button's own click handler
window.addEventListener("pointerdown", unlockAudio, { once: true, capture: true });
