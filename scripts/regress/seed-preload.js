'use strict';
// Regressions-Harness für den N-Spieler-Umbau (Skill Test).
//
// Zweck: Beweisen, dass Änderungen an der Engine das NORMALE 2-Spieler-
// Spiel nicht verändern. Der Harness lässt dieselben headless CPU-Spiele
// (PP_TRAIN-Runner) mit festem Zufalls-Seed laufen und schreibt je Spiel
// einen Fingerabdruck (Hash über das komplette actionLog + Ausgang).
// Vor und nach einem Umbau müssen die Fingerabdrücke identisch sein.
//
// Aufruf (siehe scripts/regress/run-2p.sh):
//   PP_REGRESS_SEED=1 PP_REGRESS_OUT=/pfad/fp.jsonl PP_TRAIN=1 ... \
//     node -r ./scripts/regress/seed-preload.js server.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const seed = parseInt(process.env.PP_REGRESS_SEED || '1', 10) >>> 0;
let s = seed || 1;
function mulberry32() {
  s = (s + 0x6D2B79F5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
Math.random = mulberry32;

// Virtuelle Uhr: Zeitbudgets (MCTS, Hook-Timeouts) dürfen den Spielverlauf
// nicht beeinflussen. Jeder Aufruf schiebt die Uhr um 1 ms vor.
let vclock = 1_700_000_000_000;
Date.now = () => ++vclock;
try {
  const { performance } = require('perf_hooks');
  performance.now = () => (++vclock - 1_700_000_000_000);
} catch { /* optional */ }

const out = process.env.PP_REGRESS_OUT;

// Fingerabdruck pro Zug: Hash über den kompletten Spielzustand zu Beginn
// jedes Zuges (Self-Play läuft im Fast Mode, das actionLog bleibt leer).
// Weicht ein Lauf ab, zeigt `turnFps`, in WELCHEM Zug die Divergenz beginnt.
const engMod = require(path.join(__dirname, '..', '..', 'cards', 'effects', '_engine.js'));
const origStartTurn = engMod.GameEngine.prototype.startTurn;
function stateHash(engine) {
  const gs = engine.gs || {};
  // Instanz-IDs sind zufällige UUID-Kurzformen (z. B. "ba44bbb3-568") und
  // dürfen den Fingerabdruck nicht beeinflussen.
  const slim = (JSON.stringify({
    turn: gs.turn, ap: gs.activePlayer, areas: gs.areaZones,
    players: (gs.players || []).map(p => ({
      heroes: p.heroes, abilityZones: p.abilityZones, supportZones: p.supportZones,
      surpriseZones: p.surpriseZones, hand: p.hand, gold: p.gold,
      mainDeck: p.mainDeck, potionDeck: p.potionDeck, discardPile: p.discardPile,
      deletedPile: p.deletedPile,
    })),
  })).replace(/[0-9a-f]{8}-[0-9a-f]{3,4}(?:-[0-9a-f]{4}){0,3}(?:-[0-9a-f]{12})?/g, 'ID');
  if (process.env.PP_REGRESS_DUMP) {
    try {
      fs.appendFileSync(process.env.PP_REGRESS_DUMP, JSON.stringify({ g: engine.__gameNo || 0, t: gs.turn, slim: JSON.parse(slim) }) + '\n', { encoding: 'utf-8' });
    } catch { /* nie stören */ }
  }
  return crypto.createHash('sha1').update(slim).digest('hex').slice(0, 10);
}
engMod.GameEngine.prototype.startTurn = function (...args) {
  try {
    if (!this._inMctsSim) (this.__fpTurns || (this.__fpTurns = [])).push(stateHash(this));
  } catch { /* nie stören */ }
  return origStartTurn.apply(this, args);
};

const rec = require(path.join(__dirname, '..', '..', 'cards', 'effects', '_train-recorder.js'));
const orig = rec.attachTrainingRecorder;
rec.attachTrainingRecorder = function (engine, opts) {
  const r = orig.call(this, engine, opts);
  const origFinish = r.finish;
  r.finish = function (winnerIdx, reason) {
    const record = origFinish.call(this, winnerIdx, reason);
    try {
      const gs = engine.gs || {};
      const turnFps = engine.__fpTurns || [];
      const fp = crypto.createHash('sha1').update(turnFps.join(',') + stateHash(engine)).digest('hex').slice(0, 16);
      if (out) {
        fs.appendFileSync(out, JSON.stringify({
          fp, winnerIdx, reason, turn: gs.turn ?? null, turnFps,
        }) + '\n', { encoding: 'utf-8' });
      }
    } catch (e) { console.error('[regress] fingerprint failed:', e.message); }
    return record;
  };
  return r;
};
