'use strict';
// W39a · a-01 · Attack-Leser, die über `afterSpellResolved` (Attack-Kartendaten) lesen — Teil 1: Frostbringer, Earth-Shattering Hammer, Idej Kunagi/Onima, Legendary Sword, Heart-Shaped Bow, Nieht, Reiza
// Auftrag (Al, 22.10.2026): "Es gibt viele Karten, die triggern, wenn eine Attack ausgeführt wird … Reagieren die auch ALLE schon auf Broghan und co?" — Regel (W32a/W34a/W35a): Effekte, die als Attack eines
// Helden zählen, lösen JEDEN Attack-Leser genauso aus wie eine echte Attack. Matrix: Leser × Quellen (Referenz "Echte Attack"; Broghan, Brackle, Arthor, Heragas, Kohta, Javelin Throw, Sword in a Bottle,
// Crusader's ×4, Bamboo Staff, Sacrificial Dagger, Infected Greatmaw, Alluring Light, Duel) × beide Sitze × Heldenziel/Kreaturenziel (`_helfer.js`, `_leser.js`, `_pruefe.js`).
// Ursache: Effekte, die als Attack zählen (Broghan, Brackle, Heragas, Kohta, Javelin Throw, Sword in a Bottle, Crusader's, Sacrificial Dagger, Infected Greatmaw, Alluring Light, Duel) feuerten kein
// `afterSpellResolved` mit Attack-Kartendaten (nur Arthor und Bamboo Staff taten es selbst) und legten ihre Ziele nicht ins Schadensprotokoll `gs._spellDamageLog`: Leser wie "hits exactly 1 target with an
// Attack" (Frostbringer, Reiza, Nieht), "performs an Attack" (Legendary Sword, Heart-Shaped Bow), "hits exactly 1 Hero" (Earth-Shattering Hammer, Idej Onima) sahen sie nie.
// Fix: `engine.alsAttackKette({ …, ziele })` setzt das Schadensprotokoll und meldet danach `afterSpellResolved` (Attack, Stufe = Fighting-Level, `_alsEffekt`); Duel meldet beide Duellanten.
// Beobachtung Basis: bei jedem dieser Leser lösen 8–13 der 17 Quellen nicht aus.
// Aufruf: node docs/niche-tests/repro/W39/a-01-attack-leser-ueber-afterspellresolved-teil-1.js   (Exit 0 = korrekt; auf der Basis 72ed5383 Exit 1)
const H = require('./_helfer.js').H;
const P = require('./_pruefe.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
(async () => {
  const R = H.runner();
  await P.pruefe(R, { leser: ["Blade of the Frostbringer", "Earth-Shattering Hammer, Relic of Deri", "Idej Sword - Kunagi", "Idej Sword - Onima", "Legendary Sword of a Barbarian King", "Heart-Shaped Bow, the Final Proof of Cuteness", "Nieht, the Blitz Blade", "Reiza, the Chief Tormentor"], treiber: P.POSITIV });
  await P.gegenproben(R, { leser: ["Blade of the Frostbringer", "Earth-Shattering Hammer, Relic of Deri", "Idej Sword - Kunagi", "Idej Sword - Onima", "Legendary Sword of a Barbarian King", "Heart-Shaped Bow, the Final Proof of Cuteness", "Nieht, the Blitz Blade", "Reiza, the Chief Tormentor"] });
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
