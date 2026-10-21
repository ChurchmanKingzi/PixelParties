'use strict';
// W39a · a-08 · Zielschutz (Butterfly Cloud, Invisibility), Truth-Seeing Eye und Jumpscare gelten auch für Effekte, die als Attack zählen
// Auftrag (Al, 22.10.2026): "Es gibt viele Karten, die triggern, wenn eine Attack ausgeführt wird … Reagieren die auch ALLE schon auf Broghan und co?" — Regel (W32a/W34a/W35a): Effekte, die als Attack eines
// Helden zählen, lösen JEDEN Attack-Leser genauso aus wie eine echte Attack. Matrix: Leser × Quellen (Referenz "Echte Attack"; Broghan, Brackle, Arthor, Heragas, Kohta, Javelin Throw, Sword in a Bottle,
// Crusader's ×4, Bamboo Staff, Sacrificial Dagger, Infected Greatmaw, Alluring Light, Duel) × beide Sitze × Heldenziel/Kreaturenziel (`_helfer.js`, `_leser.js`, `_pruefe.js`).
// 1) Sword in a Bottle (Ziel-Trank, eigene Zielliste) kannte den Hero-Zielschutz `untargetable`/`invisible` nicht: ein Butterfly-Cloud-/Invisibility-Held war wählbar. Fix: `engine.heroStatusSchutzFilter`/
//    `heroStatusGeschuetztGegen` in `normalizeValidTargets` und `validateSelection` (Truth-Seeing Eye des Angreifers und Chuck heben ihn auf).
// 2) Truth-Seeing Eye ("can choose any target with Attacks and Spells") erkannte nur Attack-/Spell-KARTEN als Quelle: Heldeneffekte (Broghan, Brackle, Heragas, Kohta, Alice), Javelin Throw, Crusader's ×4,
//    Bamboo Staff, Sacrificial Dagger ignorierten das Auge. Fix: `_sourceHasTruthSeeingEye` akzeptiert Quellen, die als Attack/Spell zählen; die Picker fragen die Quelle des Helden (`attackerSourceOverride`).
// 3) Jumpscare ("After the Attack, Spell or effect resolves, choose any target and Stun it") blieb bei Javelin Throw und Sword in a Bottle bis zum Zugende liegen: `doConfirmPotion` löste aufgeschobene
//    Surprises nicht ein (die anderen Aktionspfade tun es am Ende der Aktion).
// Beobachtung Basis: Zielschutz bei Sword in a Bottle; Truth-Seeing Eye bei 8 von 11 Quellen; Jumpscare bei Javelin Throw/Sword in a Bottle/Bamboo Staff/Sacrificial Dagger.
// Aufruf: node docs/niche-tests/repro/W39/a-08-zielschutz-truth-seeing-eye-und-jumpscare-bei-item-effekten.js   (Exit 0 = korrekt; auf der Basis 72ed5383 Exit 1)
const H = require('./_helfer.js').H;
const P = require('./_pruefe.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
(async () => {
  const R = H.runner();
  await P.pruefe(R, { leser: ["Schutz: untargetable (Butterfly Cloud)", "Schutz: invisible (Invisibility)", "Truth-Seeing Eye", "Jumpscare"], treiber: P.POSITIV });
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
