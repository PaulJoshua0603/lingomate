# Lingomate

Learn Australian, American and British English: a dictionary of everyday words and slang from all three countries, spaced-repetition flashcards, quizzes, pronunciation practice and a translator. Installable on iPhone and Android (PWA) and works offline.

## Run locally

No build step. Serve the folder with any static server:

```bash
python -m http.server 5173
# open http://localhost:5173
```

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
| `app.js` | App logic: dictionary, flashcards, quiz, progress, translator |
| `data.js` | Word lists. `CONCEPTS` = one meaning with the US, AU and UK word; `SLANG` = country-specific slang |
| `sw.js` | Offline cache. Bump `CACHE` when you change the file list |
| `manifest.json`, `icons/` | Home-screen install name and icons |

## Third-party services

- **Google Translate** (unofficial `translate.googleapis.com` endpoint) with **MyMemory** as a fallback, for translations and Filipino meanings. Text you translate is sent to these services.
- **Free Dictionary API** (`dictionaryapi.dev`) for phonetics, recordings and full-dictionary lookups. Optional: the app works without it.
- **flagcdn.com** for flag images, **Google Fonts** for Google Sans.

Voice input and pronunciation practice use the browser's speech recognition (Chrome, Edge, Safari; not Firefox) and need HTTPS.

## Data

Progress, saved words and history are stored in the browser's `localStorage`. Use **My Words → Backup → Export** to move them to another device.
