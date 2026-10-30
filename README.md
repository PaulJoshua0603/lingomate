# Lingomate

Your personal Australian English coach, built for Filipino professionals working with Australian managers and colleagues. AI conversations with an Aussie workmate, HR weekly check-in practice, live call simulations with a manager, voice and pronunciation practice, an Australian slang and culture guide, and progress tracking, plus a 448-word dictionary of Philippine, American, Australian and British English with flashcards and quizzes. Installable on iPhone and Android (PWA).

## Connect the AI tutor

The AI features run in Vercel serverless functions (`api/`), so API keys never reach the browser. In Vercel → project → **Settings → Environment Variables**, add:

| Variable | Required | What it is |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Yes | Your Claude API key from console.anthropic.com |
| `COACH_ACCESS_CODE` | Yes | A passphrase you make up. The app asks for it once (Settings → AI connection) so strangers can't spend your API credits through the public URL |
| `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` | Optional | An Azure Speech resource, for the neural Australian voice and precise pronunciation scores. Without it, the app uses the device's voice and a basic pronunciation check, and labels them as such |
| `COACH_MODEL` | Optional | Claude model ID. Defaults to `claude-opus-5-5` |

Redeploy after adding variables. The AI uses `claude-opus-5-5` at low effort for quick replies, with server-side refusal fallbacks enabled.

## Run locally

The word library works with any static server (`python -m http.server 5173`). The AI coach needs the serverless functions: run `npx vercel dev` with the variables above in `.env.local`.

## Deploy to Vercel

1. Push this folder to a GitHub repository.
2. In Vercel, **Add New → Project**, import the repo, keep the framework preset as **Other**, and deploy. No build command or output directory is needed.
3. If the domain changes, update the `og:image` and `og:url` tags in `index.html`.

Live: https://lingomate-self.vercel.app

## Project layout

| File | Purpose |
| --- | --- |
| `index.html` | Page structure and all views |
| `styles.css` | Design tokens, light/dark themes, layout |
| `app.js` | Core helpers and the word library: dictionary, flashcards, quiz, translator |
| `coach.js` | The coach: conversations, check-in, live call, voice practice, slang guide, progress, settings |
| `coach-data.js` | Coach content: topics, scenarios, practice sentences, listening drills, slang and culture guide |
| `api/` | Serverless functions: `chat` (Claude), `status`, `tts` and `pronounce` (Azure Speech) |
| `data.js` | Word lists. `CONCEPTS` = one meaning with the US, AU and UK word; `SLANG` = country-specific slang |
| `sw.js` | Offline cache. Bump `CACHE` when you change the file list |
| `manifest.json`, `icons/` | Home-screen install name and icons |

## Third-party services

- **Claude API** (Anthropic) for the AI tutor, manager role-plays and feedback. Your conversation text is sent to it from the server.
- **Azure Speech** (optional) for the neural voice and pronunciation assessment. Your recordings are sent to it from the server.
- **Google Translate** (unofficial `translate.googleapis.com` endpoint) with **MyMemory** as a fallback, for translations and Filipino meanings. Text you translate is sent to these services.
- **Free Dictionary API** (`dictionaryapi.dev`) for phonetics, recordings and full-dictionary lookups. Optional: the app works without it.
- **flagcdn.com** for flag images, **Google Fonts** for Google Sans.

Voice input and pronunciation practice use the browser's speech recognition (Chrome, Edge, Safari; not Firefox) and need HTTPS.

## Data

Settings, coach progress, saved words and history are stored in the browser's `localStorage`. Use **My Words → Backup → Export** to move them to another device.
