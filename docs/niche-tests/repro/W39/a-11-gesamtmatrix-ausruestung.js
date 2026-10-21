'use strict';
// W39a · a-11 · Gesamtmatrix 1/3: alle Ausrüstungs-Leser (Schwerter, Waffen, Bögen …) × alle Quellen, die als Attack zählen
// Auftrag (Al, 22.10.2026): "Es gibt viele Karten, die triggern, wenn eine Attack ausgeführt wird … Reagieren die auch ALLE schon auf Broghan und co?" — Regel (W32a/W34a/W35a): Effekte, die als Attack eines
// Helden zählen, lösen JEDEN Attack-Leser genauso aus wie eine echte Attack. Matrix: Leser × Quellen (Referenz "Echte Attack"; Broghan, Brackle, Arthor, Heragas, Kohta, Javelin Throw, Sword in a Bottle,
// Crusader's ×4, Bamboo Staff, Sacrificial Dagger, Infected Greatmaw, Alluring Light, Duel) × beide Sitze × Heldenziel/Kreaturenziel (`_helfer.js`, `_leser.js`, `_pruefe.js`).
// Vollständige Prüfung der Ausrüstung am schlagenden Helden (siehe `_leser.js`: EQUIPS, EQUIPS2, EQUIPS3) gegen alle 17 Quellen, beide Sitze, Helden- und Kreaturenziel; dazu die Gegenproben
// (Siphem [gewöhnlicher Heldeneffekt], Alice und ein echter Spell lösen Attack-Leser nicht aus).
// Aufruf: node docs/niche-tests/repro/W39/a-11-gesamtmatrix-ausruestung.js   (Exit 0 = korrekt; auf der Basis 72ed5383 Exit 1)
const H = require('./_helfer.js').H;
const P = require('./_pruefe.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
(async () => {
  const R = H.runner();
  await P.pruefe(R, { leser: ["Blade of the Frostbringer", "Blade of the Swamp Witch", "The Sun Sword", "Explosivo's Sword", "Vampiric Sword", "Warhorse", "The Master's Sword", "Glass Sword", "Sacred Hammer of the Volcano", "Super-Killing Knife, the Tool of Liquidation", "Earth-Shattering Hammer, Relic of Deri", "The Hands of Big Gwen", "Skullmael's Greatsword", "Future Tech Bazooka", "Legendary Sword of a Barbarian King", "Heart-Shaped Bow, the Final Proof of Cuteness", "The Brewer's Blade", "Shattered Trident, Treasure of the Deepsea", "Phalanx Pike", "Heart of Ice (Träger wird getroffen)", "Heart of Ice (Träger stirbt)", "Club of Gobbo", "Idej Sword - Kunagi", "Idej Sword - Onima", "Bow of the Hunt Goddess", "Future Tech Doomsday Bomb", "Truth-Seeing Eye", "Elixir of Strength (Buff)", "Guardian Beast Niu (Buff)", "Elixir of Cold (Buff)"], treiber: P.POSITIV });
  await P.gegenproben(R, { leser: ["Blade of the Frostbringer", "Blade of the Swamp Witch", "The Sun Sword", "Explosivo's Sword", "Vampiric Sword", "Warhorse", "The Master's Sword", "Glass Sword", "Sacred Hammer of the Volcano", "Super-Killing Knife, the Tool of Liquidation", "Earth-Shattering Hammer, Relic of Deri", "The Hands of Big Gwen", "Skullmael's Greatsword", "Future Tech Bazooka", "Legendary Sword of a Barbarian King", "Heart-Shaped Bow, the Final Proof of Cuteness", "The Brewer's Blade", "Shattered Trident, Treasure of the Deepsea", "Phalanx Pike", "Heart of Ice (Träger wird getroffen)", "Heart of Ice (Träger stirbt)", "Club of Gobbo", "Idej Sword - Kunagi", "Idej Sword - Onima", "Bow of the Hunt Goddess", "Future Tech Doomsday Bomb", "Truth-Seeing Eye", "Elixir of Strength (Buff)", "Guardian Beast Niu (Buff)", "Elixir of Cold (Buff)"] });
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
