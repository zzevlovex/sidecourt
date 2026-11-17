# Sidecourt (working title)

> **The app now lives in [`app/`](app/), rebuilt with SvelteKit.** See [`app/README.md`](app/README.md)
> to run it. The files in this folder (`index.html`, `openplay.html`, `scoreboard.html`,
> `js/`, `css/`, `tests/`) are the original version, kept for reference; they can be
> deleted once you are happy with the new one.

Pickleball and badminton scoring with an open play queue manager.
Version 1 runs entirely in the browser: no accounts, no server, no cost.

## Run it in VS Code

1. Unzip this folder and open it in VS Code (**File > Open Folder**).
2. Open the Extensions panel, search for **Live Server** (by Ritwick Dey) and install it.
3. Right-click `index.html` and choose **Open with Live Server**.
4. The app opens in your browser. Any file you save reloads the page.

Opening `index.html` by double-clicking will not work, because the app uses
JavaScript modules, which browsers only load from a local server.

## What works now

- **Scoreboard** (`scoreboard.html`): pickleball side-out scoring (singles or doubles,
  to 11, 15 or 21) and badminton rally scoring (to 21, cap 30, best of three). Undo and restart.
- **Open play board** (`openplay.html`) for the queue manager:
  - check in one player or a whole group (comma-separated), with an "added by" label
  - partners who stay together, or random teammates
  - "Players can pick" / "Random only" switch
  - move players up, remove them, add courts
  - a "Next game" preview showing exactly who plays and who is paired with whom
    (random teammates are decided ahead of time; "Shuffle teammates" re-rolls them),
    plus the game after that
  - "Send to Court N", and "Finish game" which calls the next game, with a spoken call-out
  - toasts with Undo for sending, finishing and removing
  - games played per player, and recent results
- **Scoring linked to the queue**: "Keep score" on a court opens its scoreboard. When the
  game ends, "Save result and call next" records the score and calls the next four.
  The score is saved after every rally: going Back shows the live score on the court card,
  and opening the scoreboard again picks up where it left off. The scoreboard also shows
  the next game from the line.
- **Ending open play and rankings**: "End open play" opens a dialog that previews the top 3
  and asks whether games still on court count (at their current score) or not. The final
  standings page shows a podium, the full ranking (wins, then win rate, then point
  difference), every game played, and "Copy standings" for a group chat.
- Data is saved in the browser, so a refresh does not lose the session.

## Not built yet

- Players joining from their own phones, and a shared live board on other devices.
  Everything currently lives on the one device that runs the session.
- Partner requests that wait for approval (the manager adds partners directly for now).
- Putting the site online.

## Files

| File | What it does |
|---|---|
| `js/scoring.js` | Scoring rules for both sports |
| `js/queue.js` | Queue, teammates and court rotation rules |
| `js/storage.js` | Saving to the browser; the place to add an online database later |
| `js/scoreboard.js`, `js/openplay.js` | The two screens |
| `css/styles.css` | Colours, type and layout |
| `tests/run.mjs` | Rule checks. If you have Node.js: `node tests/run.mjs` |

To rename the app, change `Sidecourt` in the three HTML files and in `js/storage.js`.
