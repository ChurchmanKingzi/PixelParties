'use strict';
// W39a · a-07 · Güldefaber und The Brewer's Blade: "when this Hero performs an Attack (or Spell)" zählt auch einen Effekt, der als Attack zählt
// Auftrag (Al, 22.10.2026): "Es gibt viele Karten, die triggern, wenn eine Attack ausgeführt wird … Reagieren die auch ALLE schon auf Broghan und co?" — Regel (W32a/W34a/W35a): Effekte, die als Attack eines
// Helden zählen, lösen JEDEN Attack-Leser genauso aus wie eine echte Attack. Matrix: Leser × Quellen (Referenz "Echte Attack"; Broghan, Brackle, Arthor, Heragas, Kohta, Javelin Throw, Sword in a Bottle,
// Crusader's ×4, Bamboo Staff, Sacrificial Dagger, Infected Greatmaw, Alluring Light, Duel) × beide Sitze × Heldenziel/Kreaturenziel (`_helfer.js`, `_leser.js`, `_pruefe.js`).
// Ursache: beide hängen an `onAnyActionResolved` (Aktions-Hook, nur gespielte Karten / Aktivierungen mit Aktionstyp attack/spell). Effekte, die als Attack/Spell zählen, melden stattdessen `onEffectCountedAsArt`
// (W34a): Javelin Throw, Sword in a Bottle, Bamboo Staff, Sacrificial Dagger, Infected Greatmaw, Alluring Light, Broghan, Brackle, Heragas, Kohta, Crusader's, Alice lösten die Karten nie aus.
// Fix: je ein `onEffectCountedAsArt`-Hook, der den vorhandenen Aktions-Handler mit der Art des Effekts aufruft.
// Beobachtung Basis: Güldefaber 1 von 13, Brewer's Blade 1 von 24 Zellen.
// Aufruf: node docs/niche-tests/repro/W39/a-07-zaehlhooks-gueldefaber-und-brewers-blade.js   (Exit 0 = korrekt; auf der Basis 72ed5383 Exit 1)
const H = require('./_helfer.js').H;
const P = require('./_pruefe.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
(async () => {
  const R = H.runner();
  await P.pruefe(R, { leser: ["Güldefaber, the King of Dwarfs", "The Brewer's Blade"], treiber: P.POSITIV });
  await P.gegenproben(R, { leser: ["Güldefaber, the King of Dwarfs", "The Brewer's Blade"] });
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
