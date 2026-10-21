'use strict';
// W39a · a-02 · Attack-Leser über `afterSpellResolved` / Schadensprotokoll — Teil 2: Santa Klaus, Vinepire, Warhorse, The Master's Sword, Zsos'Ssar, Taio (Nachguss), Heart of Ice
// Auftrag (Al, 22.10.2026): "Es gibt viele Karten, die triggern, wenn eine Attack ausgeführt wird … Reagieren die auch ALLE schon auf Broghan und co?" — Regel (W32a/W34a/W35a): Effekte, die als Attack eines
// Helden zählen, lösen JEDEN Attack-Leser genauso aus wie eine echte Attack. Matrix: Leser × Quellen (Referenz "Echte Attack"; Broghan, Brackle, Arthor, Heragas, Kohta, Javelin Throw, Sword in a Bottle,
// Crusader's ×4, Bamboo Staff, Sacrificial Dagger, Infected Greatmaw, Alluring Light, Duel) × beide Sitze × Heldenziel/Kreaturenziel (`_helfer.js`, `_leser.js`, `_pruefe.js`).
// Wie a-01. Zuschläge ("increase that Attack's damage by …") lesen das Schadensprotokoll: Warhorse und The Master's Sword zählen "genau EIN Ziel" über `gs._spellDamageLog.length === 1`, Zsos'Ssar ebenso;
// Vinepire sammelt den Schaden über die Sitzung des Protokolls und heilt im `afterSpellResolved`; Heart of Ice vergilt den Treffer im `afterSpellResolved`.
// Beobachtung Basis: Warhorse/Master's Sword 12 von 60 Zellen, Santa Klaus/Zsos'Ssar/Vinepire/Taio nur bei Echte Attack, Arthor, Bamboo Staff.
// Aufruf: node docs/niche-tests/repro/W39/a-02-attack-leser-ueber-afterspellresolved-teil-2.js   (Exit 0 = korrekt; auf der Basis 72ed5383 Exit 1)
const H = require('./_helfer.js').H;
const P = require('./_pruefe.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
(async () => {
  const R = H.runner();
  await P.pruefe(R, { leser: ["Santa Klaus", "Vinepire", "Warhorse", "The Master's Sword", "Zsos'Ssar, the Serpent Warlord", "Taio, Absorber of the Mountain's Heart (Nachguss)", "Heart of Ice (Träger wird getroffen)"], treiber: P.POSITIV });
  await P.gegenproben(R, { leser: ["Santa Klaus", "Vinepire", "Warhorse", "The Master's Sword", "Zsos'Ssar, the Serpent Warlord", "Taio, Absorber of the Mountain's Heart (Nachguss)", "Heart of Ice (Träger wird getroffen)"] });
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
