# Menu Reader

**Point your phone at a menu, and ask about it out loud.**

Menu Reader is a voice-first web app for people who can't easily read restaurant menus: people with low vision, people with food allergies, and travellers reading a menu in another language. Take a photo of the menu, then listen to it, ask questions ("what's the cheapest pasta?"), or have any dish described, with allergy alerts that are written by code, not guessed by AI.

## Features

- **Scan a menu:** up to 4 photos. Gemini reads every dish, price, and likely allergen.
- **Read, Describe, Ask:** on every dish.
  - **Read:** reads the dish aloud instantly, on the phone (no server call).
  - **Describe:** what the dish usually looks and tastes like, and how it's eaten.
  - **Ask:** voice or typed questions, with follow-ups ("is it spicy?").
- **Allergy alerts you can trust:** pick your allergies once. Dishes that *contain* them come with an alert first; dishes that *might* contain them come with a "check with your server" note. The app never calls a dish "safe".
- **Translation:** English, Spanish, French, Chinese and Arabic. Menus and answers are translated, and each dish keeps its printed name so you can order it.
- **Voice:** tap to talk, tap again to send, with your words shown live as you speak.
- **Accessible by design:** high-contrast AAA colours, large touch targets, a font made for low vision (Atkinson Hyperlegible), sound cues, and a screen-reader mode that leaves reading to VoiceOver / TalkBack.
- **Recent scans:** saved on the phone, with avoid / ask counts for your allergies.

## How it works

```
Phone (React)                         Flask server                      Gemini
─────────────                         ────────────                      ──────
photos ──► POST /api/parse ─────────► shrink photos ─────────────────► read + translate menu (JSON)
           menu saved on the phone ◄── clean_menu() (fix mistakes)  ◄──
question ─► POST /api/ask ──────────► search_menu tool ◄──────────────► chooses filters
           (menu sent with it)        find_items() in Python             writes the answer
           answer read aloud ◄──────── + allergy alerts (code) ◄───────
```

**Code decides, AI phrases.** Prices, filtering, sorting and allergy alerts are plain Python (`server/menu.py`, `server/ai.py`), tested in `server/tests/`. Gemini only understands questions and writes descriptions, so it can't invent a price or miss an allergy.

**The server keeps nothing.** The phone stores each scan and sends the menu with every question, so server restarts and sleeping hosts can't lose a menu.

## Tech stack

| Part | Tech |
|---|---|
| Frontend | React 19, Vite, React Router |
| Backend | Python, Flask, Pydantic, Pillow |
| AI | Google Gemini (`google-genai`): vision, structured output, tool calling |
| Voice | Browser Web Speech API (speech recognition + speech synthesis), free and on-device |
| CI | GitHub Actions PR review bot (Gemini) |

## Setup

**You need:** Node.js 20+, Python 3.10+, and a Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey).

### 1. Backend

Windows (PowerShell):

```powershell
cd server
py -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

macOS / Linux:

```bash
cd server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Then put your key in `server/.env`:

```dotenv
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-3.5-flash-lite
```

> Put the key in `.env`, **not** `.env.example` (that file is committed). Leave the key empty to run in **mock mode**, with a sample menu and no AI calls, which is handy for working on the UI.
>
> `gemini-3.5-flash-lite` is recommended: `gemini-flash-latest` has a much lower daily free-tier limit.

### 2. Frontend

From the repo root:

```bash
npm install
cd client && npm install
```

## Running

```bash
npm run dev
```

Open **http://localhost:5173**. This starts Flask (port 5001) and Vite (port 5173) together; Vite forwards `/api` requests to Flask.

### Testing on a phone (use ngrok)

Phones only allow the microphone on HTTPS, and they don't remember the mic permission on self-signed certificates, so voice works once and then stops. Use [ngrok](https://ngrok.com) for a real HTTPS address:

```bash
npm run dev
```

and in a second terminal:

```bash
ngrok http 5173
```

Open the `https://….ngrok-free.app` address on your phone. Each ngrok address has its own storage, so set your allergies and rescan after restarting ngrok.

> `npm run dev:phone` (self-signed HTTPS on your Wi-Fi) still works for everything except the microphone.

### Tests

```bash
npm test
```

Runs the server tests (menu logic, allergy alerts, translations, API routes, and Gemini calls faked with no network).

## API

| Route | Body | Returns |
|---|---|---|
| `GET /api/health` | — | `{ status, mock }` |
| `POST /api/parse` | multipart: `images` (up to 4), `language` | `{ menu, overview_speech, pages, mock }` |
| `POST /api/ask` | JSON: `menu`, `question`, `allergies`, `history`, `dish`, `language` | `{ speech, items }` |

Errors are always `{ "error": "…" }`, worded so the app can read them aloud.

## Project structure

```
.github/            PR review bot (Gemini reviews every pull request)
client/src/
  pages/            HomePage, MenuPage, SettingsPage, ReadingPage, WelcomePage
  components/       BottomNav, AnswerSheet (answer modal), ScanCard, ...
  context/, hooks/  settings (allergies, language), saved scans, voice
  lib/              api, speech (voice in/out), spoken (Read text), languages
  theme/tokens.css  colours and sizes (all AAA contrast)
server/
  app.py            API routes
  ai.py             everything that talks to Gemini
  menu.py           menu model, allergy filtering (no AI)
  i18n.py           allergen names and alert wording in each language
  tests/            pytest suite
scripts/            cross-platform helper to run the server's Python
```

## Deploying (Render)

Create one **Web Service** from this repo:

| Setting | Value |
|---|---|
| Build command | `npm run build && pip install -r server/requirements.txt` |
| Start command | `cd server && gunicorn app:app --timeout 90` |
| Environment | `GEMINI_API_KEY`, `GEMINI_MODEL` |

Flask serves the built React app and the API from one address. The free tier sleeps when idle, so open the site a minute before a demo.

## PR review bot

Every pull request gets a Gemini code review comment. To enable it, add `GEMINI_API_KEY` in **Settings → Secrets and variables → Actions**. If there's a `BLUEPRINT.md` in the repo, the bot also flags changes that drift from the plan.

## Known limitations

- **Menus don't list every ingredient.** Alerts are based on the menu text plus common recipes; always confirm with the server.
- AI allergen tagging can vary between scans of the same menu.
- Voice quality depends on the phone. On iPhone, download an **Enhanced** or **Premium** voice (Settings → Accessibility → Spoken Content → Voices) for a more natural voice.
- The app's own buttons and labels are English only; menus and answers are translated.
- Translations of the allergy wording still need a native-speaker review.
- The Gemini free tier has daily limits; use a separate key for demo day.

## Roadmap

- Voice picker and speed control in Settings
- Optional natural AI voice (Gemini text-to-speech) with the phone voice as a fallback
- Delete saved scans
- Translate the app's own buttons and labels
- Profiles (save preferences with your email)
