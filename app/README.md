# Sidecourt app

Built with SvelteKit (Svelte 5) and Supabase. It is a static site that installs on phones and works offline.

## Run it

You need [Node.js](https://nodejs.org) 22.17 or newer.

```bash
cd app
npm install
cp .env.example .env   # then fill it in with your staging project
npm run dev
```

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Runs the app at http://localhost:5173 |
| `npm test` | Checks the game and history rules |
| `npm run check` | Checks the components for mistakes |
| `npm run lint` | Checks code quality |
| `npm run build` | Builds the site into `build/` |
| `npm run test:e2e` | Runs the app in Chrome and plays through real flows (build first) |
| `npm run verify` | All of the above, in order. Run it before pushing |
| `npm run icons` | Redraws the app icons from the logo |

GitHub runs the same checks on every push (`.github/workflows/ci.yml`).

## Where things are

| Path | What it does |
|---|---|
| `src/lib/logic/` | The rules, with no screen code: scoring, queue and rankings, keys, lobby, history, share cards |
| `src/lib/*.svelte.js` | Shared state: session store, account, lobby sync, upload queue, past players |
| `src/lib/openplay/` | Open play screens and `actions.js`, which holds what each button does |
| `src/lib/components/` | Shared pieces |
| `src/routes/` | The pages |
| `src/service-worker.js` | Offline support |
| `supabase/` | Database files, run in order. See [`supabase/SETUP.md`](supabase/SETUP.md) |
| `static/_headers` | Security headers for Cloudflare Pages |
| `tests/` | `run.mjs` (rules) and `e2e/` (browser) |

## Hosting

Cloudflare Pages builds every push to `main`: root directory `app`, build command `npm run build`,
output `build`. Set `NODE_VERSION`, `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_PUBLISHABLE_KEY` there.
