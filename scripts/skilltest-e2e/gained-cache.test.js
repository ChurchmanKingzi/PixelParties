'use strict';
// Gewonnene Heldeneffekte (`_gainedScriptCache`) überleben Snapshot/Restore der Suche (Lookahead) mit allen Funktionen.
// Fund aus dem Lookahead-Vergleich: nach `restore` war das zusammengeführte Skript JSON-kopiert (Flaggen da, Funktionen weg) →
// „heroScript.onHeroRedirect is not a function" im Basisangriff.
//   node scripts/skilltest-e2e/gained-cache.test.js
process.env.PP_ST_SIM = '1';
const { runGame } = require('../../skilltest/sim');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

(async () => {
  const oL = console.log, oE = console.error;
  console.log = () => {}; console.error = () => {};
  const out = await runGame({ seats: 3, setupOnly: true, noProfileSeats: [0, 1, 2], seed: 9 });
  console.log = oL; console.error = oE;
  const { engine, gs } = out;
  const seat = 0, hi = gs.players[seat].heroes.findIndex(h => h && h.name && h.hp > 0);
  const hero = () => gs.players[seat].heroes[hi];
  hero().gainedEffectNames = ['Alleria, the Queen of Spiders'];
  let sc = engine.heroScript(hero());
  check('zusammengeführtes Skript hat die Funktion (vor dem Snapshot)', !!sc && sc.heroRedirect === true && typeof sc.onHeroRedirect === 'function', sc && Object.keys(sc).length);
  const snap = engine.snapshot();
  // Zustand verändern, dann zurücksetzen (wie ein Rollout)
  hero().hp -= 10;
  engine.restore(snap);
  sc = engine.heroScript(hero());
  check('…und nach snapshot/restore noch', !!sc && sc.heroRedirect === true && typeof sc.onHeroRedirect === 'function', sc && { keys: Object.keys(sc).length, fn: typeof sc.onHeroRedirect });
  check('der Zwischenspeicher steht nicht im Snapshot/JSON des Helden', !('_gainedScriptCache' in JSON.parse(JSON.stringify(hero()))));
  console.log(fails ? `\n✗ ${fails} Fehler` : '\n✓ Gewonnene-Effekte-Tests grün');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
