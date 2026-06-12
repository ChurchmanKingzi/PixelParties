// Pixel Parties — Electron desktop shell.
//
// This is a thin desktop window around the existing web client. The game
// itself (server, multiplayer, lobbies, DB) is unchanged and lives wherever
// you host it. This shell just loads that URL in a Chromium window.
//
// Nothing here touches the Node/Express server code.

const {
  app, BrowserWindow, Menu, shell, screen, powerSaveBlocker, dialog,
} = require('electron');
const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// Where to load the game from.
//
//   - For LOCAL TESTING: run your server (`node server.js` in the project
//     root) and set this to the localhost URL (or flip USE_PRODUCTION to false).
//   - For the PRODUCTION/Steam build: USE_PRODUCTION = true loads Render.
//
// Override at runtime any time with:  PIXEL_PARTIES_URL=http://localhost:3000 npm start
// ---------------------------------------------------------------------------
const LOCAL_URL = 'http://localhost:3000';
const PRODUCTION_URL = 'https://pixelparties.onrender.com';
const USE_PRODUCTION = true;

const TARGET_URL =
  process.env.PIXEL_PARTIES_URL ||
  (USE_PRODUCTION ? PRODUCTION_URL : LOCAL_URL);

const IS_DEV = !app.isPackaged;

let mainWindow = null;
let splashWindow = null;
let mainRevealed = false;
let savedZoomFactor = 1;

// Cold-start auto-retry: Render's free tier sleeps when idle and can take
// ~30-60s to wake. Rather than show an error, keep the splash up and quietly
// reload a few times before giving up.
const MAX_COLD_START_RETRIES = 15;
let retryCount = 0;
let retryTimer = null;

// ===========================================================================
// Single-instance lock — a second launch focuses the running window instead
// of opening a duplicate (Steam users tend to double-click launchers).
// ===========================================================================
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
  app.whenReady().then(start);
}

// ===========================================================================
// Window-state persistence — remember size/position/maximized across runs.
// Stored as JSON in the per-user app data folder (no extra dependency).
// ===========================================================================
const stateFile = path.join(app.getPath('userData'), 'window-state.json');

function loadWindowState() {
  try {
    return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch {
    return {};
  }
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  // getNormalBounds() is the size/pos when NOT maximized/minimized — that's
  // what we want to restore to.
  const bounds = mainWindow.getNormalBounds();
  let zoomFactor = savedZoomFactor;
  try { zoomFactor = mainWindow.webContents.getZoomFactor(); } catch { /* keep last */ }
  const state = {
    ...bounds,
    isMaximized: mainWindow.isMaximized(),
    isFullScreen: mainWindow.isFullScreen(),
    zoomFactor,
  };
  try {
    fs.writeFileSync(stateFile, JSON.stringify(state));
  } catch {
    /* best-effort; ignore write failures */
  }
}

// Returns starting bounds, guarding against saved positions that are now
// off-screen (e.g. a monitor was unplugged).
function getStartBounds(state) {
  const defaults = { width: 1280, height: 800 };
  if (!state.width || !state.height) return defaults;

  const onScreen = screen.getAllDisplays().some((d) => {
    const a = d.workArea;
    return (
      state.x != null && state.y != null &&
      state.x < a.x + a.width && state.x + state.width > a.x &&
      state.y < a.y + a.height && state.y + state.height > a.y
    );
  });

  const bounds = { width: state.width, height: state.height };
  if (onScreen) {
    bounds.x = state.x;
    bounds.y = state.y;
  }
  return bounds;
}

let saveStateTimer = null;
function scheduleSaveState() {
  clearTimeout(saveStateTimer);
  saveStateTimer = setTimeout(saveWindowState, 400); // debounce resize/move spam
}

// ===========================================================================
// Display-sleep blocker — keep the screen awake while the game window is the
// focused, active window so the monitor never sleeps mid-turn.
//
// (Upgrade path: for true "only during a match" behaviour, have the web client
// call into a preload bridge to toggle this when a game starts/ends.)
// ===========================================================================
let psbId = null;
function startSleepBlocker() {
  if (psbId == null || !powerSaveBlocker.isStarted(psbId)) {
    psbId = powerSaveBlocker.start('prevent-display-sleep');
  }
}
function stopSleepBlocker() {
  if (psbId != null && powerSaveBlocker.isStarted(psbId)) {
    powerSaveBlocker.stop(psbId);
  }
  psbId = null;
}

// ===========================================================================
// Splash window — shown instantly so the (possibly slow) cold-start load is
// never a blank window.
// ===========================================================================
function createSplash() {
  splashWindow = new BrowserWindow({
    width: 640,   // 16:9 — matches title.png so the art fills with no crop
    height: 360,
    frame: false,
    resizable: false,
    movable: true,
    center: true,
    backgroundColor: '#1a1a1a',
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  splashWindow.once('ready-to-show', () => splashWindow && splashWindow.show());
  splashWindow.on('closed', () => { splashWindow = null; });
}

// Swap splash → main once the game (or the error page) has actually rendered.
function revealMainWindow() {
  if (mainRevealed || !mainWindow) return;
  mainRevealed = true;
  if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  // Pull the window to the foreground even if the player alt-tabbed away during
  // a long cold-start wait. The brief always-on-top flip defeats Windows' focus-
  // stealing prevention without leaving the window permanently pinned on top.
  mainWindow.setAlwaysOnTop(true);
  mainWindow.focus();
  mainWindow.moveTop();
  app.focus({ steal: true });
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setAlwaysOnTop(false);
  }, 400);
}

// ===========================================================================
// Main window.
// ===========================================================================
function createWindow() {
  const savedState = loadWindowState();
  const bounds = getStartBounds(savedState);

  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#1a1a1a',
    title: 'Pixel Parties',
    show: false, // stays hidden behind the splash until content is ready
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Restore maximized / fullscreen / zoom state.
  if (savedState.isMaximized) mainWindow.maximize();
  if (savedState.isFullScreen) mainWindow.setFullScreen(true);
  savedZoomFactor = savedState.zoomFactor > 0 ? savedState.zoomFactor : 1;
  retryCount = 0;

  loadGame();

  // After every load, verify we actually landed on the game — not an
  // interstitial like Render's "spinning up" holding page — before swapping the
  // splash out for the window. See handleLoaded().
  mainWindow.webContents.on('did-finish-load', handleLoaded);
  // Persist zoom changes the player makes via Ctrl+scroll.
  mainWindow.webContents.on('zoom-changed', scheduleSaveState);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!isGameUrl(url)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isGameUrl(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // If the main page fails to load, auto-retry with a short backoff (the
  // server may just be waking up) while the splash stays visible. Only after
  // exhausting the retries do we surface the friendly error screen.
  mainWindow.webContents.on('did-fail-load', (_e, errorCode, errorDesc, validatedURL, isMainFrame) => {
    if (errorCode === -3) return;   // aborted load (normal during redirects)
    if (!isMainFrame) return;       // ignore subframe/iframe failures
    if (retryCount < MAX_COLD_START_RETRIES && isGameUrl(validatedURL)) {
      scheduleColdStartRetry();
      return;
    }
    showErrorPage(errorDesc, validatedURL);
  });

  // Crash recovery — the renderer process died; offer a reload.
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    if (details.reason === 'clean-exit') return;
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: 'error',
      title: 'Pixel Parties',
      message: 'The game crashed unexpectedly.',
      detail: `Reason: ${details.reason}`,
      buttons: ['Reload', 'Quit'],
      defaultId: 0,
      cancelId: 1,
    });
    if (choice === 0) { retryCount = 0; loadGame(); } else app.quit();
  });

  // Freeze recovery — the page stopped responding; let the player wait or reload.
  let unresponsivePromptOpen = false;
  mainWindow.on('unresponsive', () => {
    if (unresponsivePromptOpen) return;
    unresponsivePromptOpen = true;
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: 'warning',
      title: 'Pixel Parties',
      message: 'The game is not responding.',
      detail: 'You can keep waiting for it to recover, or reload.',
      buttons: ['Keep waiting', 'Reload'],
      defaultId: 0,
      cancelId: 0,
    });
    unresponsivePromptOpen = false;
    if (choice === 1) { retryCount = 0; loadGame(); }
  });

  // Native right-click menu — Electron has none by default, so without this
  // copy/paste in the login and deck-search fields silently does nothing.
  mainWindow.webContents.on('context-menu', (_e, params) => {
    const { editFlags } = params;
    const hasSelection = !!(params.selectionText && params.selectionText.trim());
    const items = [];
    if (params.isEditable) {
      items.push({ role: 'cut', enabled: editFlags.canCut });
      items.push({ role: 'copy', enabled: editFlags.canCopy });
      items.push({ role: 'paste', enabled: editFlags.canPaste });
      items.push({ role: 'selectAll', enabled: editFlags.canSelectAll });
      items.push({ type: 'separator' });
    } else if (hasSelection) {
      items.push({ role: 'copy' });
      items.push({ type: 'separator' });
    }
    items.push({ label: 'Reload', click: () => { retryCount = 0; loadGame(); } });
    if (IS_DEV) {
      items.push({ type: 'separator' });
      items.push({ label: 'Inspect Element', click: () => mainWindow.webContents.inspectElement(params.x, params.y) });
    }
    Menu.buildFromTemplate(items).popup({ window: mainWindow });
  });

  // Display-sleep blocker follows window focus.
  mainWindow.on('focus', startSleepBlocker);
  mainWindow.on('blur', stopSleepBlocker);
  mainWindow.on('minimize', stopSleepBlocker);
  mainWindow.on('restore', () => { if (mainWindow.isFocused()) startSleepBlocker(); });

  // Persist window geometry.
  mainWindow.on('resize', scheduleSaveState);
  mainWindow.on('move', scheduleSaveState);
  mainWindow.on('close', saveWindowState);

  mainWindow.on('closed', () => {
    clearTimeout(retryTimer);
    stopSleepBlocker();
    mainWindow = null;
  });
}

function loadGame() {
  if (mainWindow) mainWindow.loadURL(TARGET_URL);
}

function isGameUrl(url) {
  try {
    return new URL(url).origin === new URL(TARGET_URL).origin;
  } catch {
    return false;
  }
}

// Truthy on the real game page: index.html defines window.CARDS_LOADED in an
// inline parse-time script and renders a #boot-splash element — neither exists
// on a Render "spinning up" holding page.
const GAME_MARKER_JS =
  "(typeof window.CARDS_LOADED !== 'undefined') || !!document.getElementById('boot-splash')";

// Runs after every load. A successful HTTP load isn't proof we reached the
// game: when Render's free tier is asleep, its router answers with its OWN
// holding page (200/503 + HTML) while the container wakes, so did-fail-load
// never fires. We confirm the game's marker before revealing; otherwise we
// keep the splash up and retry, exactly like a failed load.
async function handleLoaded() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const url = mainWindow.webContents.getURL();

  // Our own data: error page (or any non-game origin) — just show it.
  if (!isGameUrl(url)) { revealLoadedPage(); return; }

  let isGame = false;
  try {
    isGame = await mainWindow.webContents.executeJavaScript(GAME_MARKER_JS, true);
  } catch { /* navigation raced / page refused eval — treat as not-the-game */ }

  if (!mainWindow || mainWindow.isDestroyed()) return;

  if (isGame) { revealLoadedPage(); return; }

  // Interstitial holding page → keep waiting (splash stays up), or give up.
  if (retryCount < MAX_COLD_START_RETRIES) {
    scheduleColdStartRetry();
  } else {
    showErrorPage('The server is taking longer than expected to wake up.', url);
  }
}

function revealLoadedPage() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try { mainWindow.webContents.setZoomFactor(savedZoomFactor); } catch { /* ignore */ }
  retryCount = 0;
  revealMainWindow();
}

function scheduleColdStartRetry() {
  retryCount++;
  const delay = Math.min(2000 + retryCount * 800, 6000); // backoff, capped
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed()) loadGame();
  }, delay);
}

function showErrorPage(errorDesc, url) {
  const html = `
    <!doctype html>
    <html>
      <head><meta charset="utf-8"><title>Pixel Parties</title></head>
      <body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;
                   font-family:system-ui,sans-serif;background:#1a1a1a;color:#eee;text-align:center;">
        <div style="max-width:520px;padding:24px;">
          <h1 style="margin:0 0 12px;">Can't reach the game server</h1>
          <p style="opacity:.8;line-height:1.5;">
            Tried to load:<br><code style="color:#9cf;">${escapeHtml(url)}</code>
          </p>
          <p style="opacity:.6;font-size:14px;">${escapeHtml(errorDesc || '')}</p>
          <p style="opacity:.7;font-size:14px;">
            The server may be waking up (free hosting sleeps when idle) — give it
            a moment and retry. If you're testing locally, make sure the server
            is running (<code>node server.js</code>).
          </p>
          <button id="retry"
            style="margin-top:16px;padding:10px 22px;font-size:15px;border:0;border-radius:8px;
                   background:#e8633a;color:#fff;cursor:pointer;">Retry</button>
        </div>
        <script>
          document.getElementById('retry').addEventListener('click', () => {
            window.location.href = ${JSON.stringify(TARGET_URL)};
          });
        </script>
      </body>
    </html>`;
  mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// Minimal, game-friendly menu: reload, fullscreen, zoom, devtools, quit.
function buildMenu() {
  const template = [
    {
      label: 'Game',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => loadGame() },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'togglefullscreen' }, // F11
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        ...(IS_DEV ? [{ type: 'separator' }, { role: 'toggleDevTools' }] : []),
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function start() {
  buildMenu();
  createSplash();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainRevealed = false;
      createSplash();
      createWindow();
    }
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
