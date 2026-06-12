# Pixel Parties — Desktop Shell (Electron)

A thin desktop wrapper around the Pixel Parties web client, for packaging the
game as a Windows `.exe` (and eventually shipping it on Steam).

**This does not change the game.** The server, multiplayer, database, and all
gameplay are unchanged and still live on your host (Render). This shell is just
a Chromium window that loads that URL — the same content a browser tab shows.

## One-time setup

```bash
cd electron
npm install
```

(Installs Electron + electron-builder locally. ~250 MB; nothing global.)

## Run it locally (dev loop)

1. In the **project root**, start the game server as usual:
   ```bash
   node server.js
   ```
2. In **this folder**, launch the desktop window:
   ```bash
   npm start
   ```

The window loads `http://localhost:3000` by default. If the server isn't
running you'll get a friendly "Can't reach the game server" screen with a Retry
button — start the server and click Retry.

### Point it somewhere else
Override the URL without editing code:
```bash
# Windows PowerShell
$env:PIXEL_PARTIES_URL="https://your-app.onrender.com"; npm start
```
Or set your real Render URL in `main.js` (`PRODUCTION_URL`) and flip
`USE_PRODUCTION = true` for the shipping build.

## Build a real .exe (no Steam involved)

```bash
npm run build       # full installer + portable .exe  -> dist/
npm run build:dir   # faster: unpacked app folder only -> dist/win-unpacked/
```

Output lands in `electron/dist/`. Double-click the produced `.exe` to run it
exactly as an end user would. **No Steam account, fee, or upload is required
for any of this** — Steam only enters the picture when you explicitly upload a
build later.

## What's here

| File | Purpose |
|------|---------|
| `main.js` | Electron main process: window, URL target, external-link handling, error/retry screen, menu. |
| `preload.js` | Currently empty; the future home for Steam feature bridges. |
| `build/icon.png` | App icon (copied from the game's favicon). |
| `package.json` | Scripts + electron-builder config. |

## Later (not needed to run locally)

- **Steam features** — add `greenworks` for achievements/overlay/Steam login;
  expose them to the game through `preload.js`.
- **Bundle the frontend** — instead of loading the remote URL, ship the
  compiled `public/dist` locally so the UI loads instantly and only gameplay
  needs the network.
- **Mac/Linux targets** — add to the electron-builder `build` config.
