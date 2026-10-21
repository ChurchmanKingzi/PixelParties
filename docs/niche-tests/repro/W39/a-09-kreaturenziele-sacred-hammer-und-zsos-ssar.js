'use strict';
// W39a · a-09 · Kreaturen als Ziel: Sacred Hammer of the Volcano ("hits a Burned target") und Zsos'Ssar ("against a single target")
// Auftrag (Al, 22.10.2026): "Es gibt viele Karten, die triggern, wenn eine Attack ausgeführt wird … Reagieren die auch ALLE schon auf Broghan und co?" — Regel (W32a/W34a/W35a): Effekte, die als Attack eines
// Helden zählen, lösen JEDEN Attack-Leser genauso aus wie eine echte Attack. Matrix: Leser × Quellen (Referenz "Echte Attack"; Broghan, Brackle, Arthor, Heragas, Kohta, Javelin Throw, Sword in a Bottle,
// Crusader's ×4, Bamboo Staff, Sacrificial Dagger, Infected Greatmaw, Alluring Light, Duel) × beide Sitze × Heldenziel/Kreaturenziel (`_helfer.js`, `_leser.js`, `_pruefe.js`).
// Beide lasen nur den Heldenpfad (`beforeDamage`); trifft die Attack/der Spell eine KREATUR, fehlte der Zuschlag — auch bei einer echten Attack (Nebenfund beim Inventar). Fix: je ein
// `beforeCreatureDamageBatch` (Sacred Hammer: brennende Kreatur; Zsos'Ssar: genau ein Ziel im Schadensprotokoll).
// Beobachtung Basis: Sacred Hammer bei Kreaturenzielen 0 von 30 Zellen (auch Echte Attack), Zsos'Ssar nie bei Kreaturenzielen.
// Aufruf: node docs/niche-tests/repro/W39/a-09-kreaturenziele-sacred-hammer-und-zsos-ssar.js   (Exit 0 = korrekt; auf der Basis 72ed5383 Exit 1)
const H = require('./_helfer.js').H;
const P = require('./_pruefe.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
(async () => {
  const R = H.runner();
  await P.pruefe(R, { leser: ["Sacred Hammer of the Volcano", "Zsos'Ssar, the Serpent Warlord"], treiber: P.POSITIV });
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
