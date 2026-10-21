'use strict';
// W39a · a-04 · Kohta: "treated as this Hero hitting the target with an Attack" — die Leser von "defeats a target with an Attack" sehen den Kill
// Auftrag (Al, 22.10.2026): "Es gibt viele Karten, die triggern, wenn eine Attack ausgeführt wird … Reagieren die auch ALLE schon auf Broghan und co?" — Regel (W32a/W34a/W35a): Effekte, die als Attack eines
// Helden zählen, lösen JEDEN Attack-Leser genauso aus wie eine echte Attack. Matrix: Leser × Quellen (Referenz "Echte Attack"; Broghan, Brackle, Arthor, Heragas, Kohta, Javelin Throw, Sword in a Bottle,
// Crusader's ×4, Bamboo Staff, Sacrificial Dagger, Infected Greatmaw, Alluring Light, Duel) × beide Sitze × Heldenziel/Kreaturenziel (`_helfer.js`, `_leser.js`, `_pruefe.js`).
// Kohta besiegt das Ziel ohne Schaden. Die Leser hängen an den Schadens-Hooks ("target.hp <= 0" nach `afterDamage`, Kreaturen im Stapel-Hook) oder an den Todes-Hooks mit Schadenstyp (Future Tech Bazooka):
// Explosivo's Sword, Skullmael's Greatsword, Future Tech Bazooka, Wavilion, The Hands of Big Gwen und Heart of Ice übersahen den Kill.
// Fix: `engine.meldeAttackTrefferOhneSchaden` (Treffer mit Betrag 0, Typ attack, VOR den KO-Hooks) + `actionDefeatHero(…, { type: 'attack', meldeTreffer })` / `heldQuelle` bei der Zerstörung.
// Beobachtung Basis: bei Kohta lösen die genannten Leser nicht aus (Referenz "Echte Attack" und Broghan: ja).
// Aufruf: node docs/niche-tests/repro/W39/a-04-kohta-besiegen-ohne-schaden-lesen-defeats-with-an-attack.js   (Exit 0 = korrekt; auf der Basis 72ed5383 Exit 1)
const H = require('./_helfer.js').H;
const P = require('./_pruefe.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
(async () => {
  const R = H.runner();
  await P.pruefe(R, { leser: ["Explosivo's Sword", "The Hands of Big Gwen", "Skullmael's Greatsword", "Future Tech Bazooka", "Wavilion", "Heart of Ice (Träger wird getroffen)", "Heart of Ice (Träger stirbt)", "Corpse Explosion", "Zombified Assault"], treiber: ['Kohta', 'Echte Attack', 'Broghan'] });
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
