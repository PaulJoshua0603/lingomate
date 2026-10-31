# Lingomate

Your personal Australian English coach, built for Filipino professionals working with Australian managers and colleagues. AI conversations with an Aussie workmate, HR weekly check-in practice, live call simulations with a manager, voice and pronunciation practice, an Australian slang and culture guide, and progress tracking, plus a 448-word dictionary of Philippine, American, Australian and British English with flashcards and quizzes. Installable on iPhone and Android (PWA).

## Connect the AI tutor

The AI features run in Vercel serverless functions (`api/`), so API keys never reach the browser. In Vercel → project → **Settings → Environment Variables**, add:

| Variable | Required | What it is |
| --- | --- | --- |
| `GROQ_API_KEY` | One of these | Groq API key (console.groq.com). Used when set; tries `openai/gpt-oss-120b`, then `llama-3.3-70b-versatile`, then `openai/gpt-oss-20b`. Also turns on accurate speech-to-text (Whisper `whisper-large-v3`) for recorded answers |
| `ANTHROPIC_API_KEY` | One of these | Claude API key (console.anthropic.com). Used when no Groq key is set |
| `COACH_ACCESS_CODE` | Yes | A passphrase you make up. The app asks for it once (Settings → AI connection) so strangers can't spend your API credits through the public URL |
| `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` | Optional | An Azure Speech resource, for the natural Australian voice (Natasha / William neural) and precise pronunciation scores. The free F0 tier is enough for personal use. Without it, the app uses the device's voice (natural only in Microsoft Edge or with an iOS "Enhanced" voice) and a basic pronunciation check, and labels them as such |
| `COACH_MODEL` | Optional | Force a specific model ID for the active provider. Claude defaults to `claude-opus-5-5` |

Redeploy after adding variables. The AI uses `claude-opus-5-5` at low effort for quick replies, with server-side refusal fallbacks enabled.

## Run locally

Run `npm install`, then `npm run dev` and open http://localhost:5173. `scripts/dev.js` serves the app and runs the `api/` functions the way Vercel does. Put the variables above in `.env.local` (one `NAME=value` per line) to turn on the AI coach locally; without it the word library and voice practice still work.

Recorded answers are never sent straight away: you can listen back, re-record, and fix the transcribed words before sending.

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
| `api/` | Serverless functions: `chat` (Groq or Claude), `transcribe` (Whisper on Groq), `status`, `tts` and `pronounce` (Azure Speech) |
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
