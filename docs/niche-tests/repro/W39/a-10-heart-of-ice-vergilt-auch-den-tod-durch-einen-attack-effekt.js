'use strict';
// W39a · a-10 · Heart of Ice: auch ein tödlicher Treffer eines Effekts, der als Attack zählt, wird vergolten
// Auftrag (Al, 22.10.2026): "Es gibt viele Karten, die triggern, wenn eine Attack ausgeführt wird … Reagieren die auch ALLE schon auf Broghan und co?" — Regel (W32a/W34a/W35a): Effekte, die als Attack eines
// Helden zählen, lösen JEDEN Attack-Leser genauso aus wie eine echte Attack. Matrix: Leser × Quellen (Referenz "Echte Attack"; Broghan, Brackle, Arthor, Heragas, Kohta, Javelin Throw, Sword in a Bottle,
// Crusader's ×4, Bamboo Staff, Sacrificial Dagger, Infected Greatmaw, Alluring Light, Duel) × beide Sitze × Heldenziel/Kreaturenziel (`_helfer.js`, `_leser.js`, `_pruefe.js`).
// Heart of Ice erkannte den tödlichen Treffer (Träger stirbt, `afterDamage`) nur, wenn der NAME der Quelle eine Attack-KARTE war. Broghan, Brackle, Heragas, Javelin Throw, Sword in a Bottle, Crusader's,
// Sacrificial Dagger, Infected Greatmaw, Alluring Light und Kohta (Treffer ohne Schaden) hielten den Träger nicht für getroffen.
// Beobachtung Basis: nur Echte Attack und Duel.
// Aufruf: node docs/niche-tests/repro/W39/a-10-heart-of-ice-vergilt-auch-den-tod-durch-einen-attack-effekt.js   (Exit 0 = korrekt; auf der Basis 72ed5383 Exit 1)
const H = require('./_helfer.js').H;
const P = require('./_pruefe.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
(async () => {
  const R = H.runner();
  await P.pruefe(R, { leser: ["Heart of Ice (Träger stirbt)"], treiber: P.POSITIV });
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
