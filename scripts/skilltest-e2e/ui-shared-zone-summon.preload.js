'use strict';
// Testhilfe zu `ui-shared-zone-summon.js` (wird per NODE_OPTIONS=--require in den Server-Kindprozess geladen, nur für diesen Test).
// Feste Szene, kein Steuerport: sobald die Datei `W62_GO` existiert, feuert EINMAL der Rundenbeginn des Spielers 0 am zuletzt angelegten Puzzle-Spiel — das löst den
// Effekt von „Infinitely Reproducing Slime" aus (Beschwörung einer Kopie in die Zone). Die Abfragen des Effekts beantwortet der Test über die Oberfläche.
const fs = require('fs');
const path = require('path');
const ROOT = process.env.PP_ROOT || path.resolve(__dirname, '..', '..');
const { GameEngine } = require(path.join(ROOT, 'cards', 'effects', '_engine'));
const go = process.env.W62_GO;
const origInit = GameEngine.prototype.init;
GameEngine.prototype.init = function (...a) {
  const r = origInit.apply(this, a);
  const engine = this;
  if (!go || !engine.isPuzzle) return r;
  const timer = setInterval(async () => {
    if (!fs.existsSync(go)) return;
    clearInterval(timer);
    try {
      console.log('[W62] start');
      engine.gs.activePlayer = 0;
      await engine.runHooks('onTurnStart', { turn: engine.gs.turn, activePlayer: 0 });
      console.log('[W62] ende');
    } catch (e) { console.log('[W62] FEHLER', e && e.stack); }
  }, 100);
  return r;
};
