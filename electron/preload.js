// Preload runs in an isolated context before the game's web content loads.
//
// It exposes a tiny, safe bridge the web client can feature-detect to know it's
// running inside the desktop shell and to drive desktop-only flows. Everything
// here is allow-listed by name — the renderer never gets Node or ipcRenderer
// directly.
//
// (Upgrade path: add Steam features — achievements, overlay — alongside these.)

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pixelPartiesDesktop', {
  isDesktop: true,
  // Runs the desktop Google OAuth (PKCE) flow in the system browser and
  // resolves with a Google id_token string, or null if the user cancelled.
  // The web client posts that id_token to /api/auth/google just like the
  // browser's GIS credential.
  googleSignIn: () => ipcRenderer.invoke('pixel-parties:google-signin'),
});
