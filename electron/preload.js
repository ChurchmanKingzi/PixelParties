// Preload runs in an isolated context before the game's web content loads.
//
// Right now it does nothing — the web client works as-is. This file is the
// bridge you'll use later to expose Steam features (achievements, overlay,
// Steam login) to the game safely via contextBridge, e.g.:
//
//   const { contextBridge } = require('electron');
//   contextBridge.exposeInMainWorld('steam', { unlockAchievement: (id) => ... });
//
// Keeping it present (even empty) means main.js's preload path is always valid.
