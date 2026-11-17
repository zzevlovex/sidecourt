# Sidecourt (SvelteKit version)

Pickleball and badminton scoring with an open play queue manager.
Built with SvelteKit (Svelte 5). Installs on phones as an app and works offline.

## Run it

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
cd app
npm install      # first time only
npm run dev      # opens at http://localhost:5173 and reloads as you edit
```

To open it on your phone while developing (same Wi-Fi): `npm run dev -- --host`,
then visit the "Network" address it prints.

## Other commands

| Command | What it does |
|---|---|
| `npm test` | Checks the scoring and queue rules |
| `npm run check` | Checks every component for mistakes and accessibility problems |
| `npm run build` | Builds the finished site into `build/` |
| `npm run preview` | Serves the built site locally, to try it before putting it online |
| `npm run icons` | Redraws the app icons in `static/` |

## Put it online (free)

`npm run build` makes plain files in `build/`. Upload that folder to any static host:
Netlify (drag and drop the folder), Cloudflare Pages, Vercel or GitHub Pages.
On phones, open the site and choose **Add to Home Screen** to install it.

## Where things are

| Path | What it does |
|---|---|
| `src/lib/logic/` | The rules: `scoring.js` (both sports) and `queue.js` (line, teams, rankings). No screen code, fully tested |
| `src/lib/state.svelte.js` | The shared data for every page, saved in the browser. **The one file to change to go online** (Supabase/Firebase) |
| `src/lib/storage.js` | Reading and writing the browser's storage |
| `src/lib/openplay/` | Open play screen pieces: court cards, next game, waiting line, check-in, dialogs, standings. `actions.js` holds what every button does |
| `src/lib/scoreboard/` | The new-match form |
| `src/lib/components/` | Shared pieces: toasts, dialog |
| `src/routes/` | The pages: `/` home, `/openplay`, `/scoreboard` (`?court=1` for a court) |
| `src/app.css` | Colours, type, layout and animations |
| `src/service-worker.js` | Offline support |
| `static/` | Icons and the install manifest |
| `tests/run.mjs` | Rule checks |

## Going online later

Players joining from their own phones and a live board on several devices need a
shared database. Keep the methods in `src/lib/state.svelte.js` (`setSession`,
`setMatch`, ...) and make them save to Supabase or Firebase, and subscribe to their
live updates to set `store.session`. The rules and screens do not need to change.
