'use strict';
// W39a · a-03 · Crusader's ×4 und Bamboo Staff: die Quelle des Schlags ist der Träger (Held), nicht die Ausrüstungs-Instanz in der Support Zone
// Auftrag (Al, 22.10.2026): "Es gibt viele Karten, die triggern, wenn eine Attack ausgeführt wird … Reagieren die auch ALLE schon auf Broghan und co?" — Regel (W32a/W34a/W35a): Effekte, die als Attack eines
// Helden zählen, lösen JEDEN Attack-Leser genauso aus wie eine echte Attack. Matrix: Leser × Quellen (Referenz "Echte Attack"; Broghan, Brackle, Arthor, Heragas, Kohta, Javelin Throw, Sword in a Bottle,
// Crusader's ×4, Bamboo Staff, Sacrificial Dagger, Infected Greatmaw, Alluring Light, Duel) × beide Sitze × Heldenziel/Kreaturenziel (`_helfer.js`, `_leser.js`, `_pruefe.js`).
// Ursache: Crusader's (Heldentreffer über `ctx.dealDamage`) und Bamboo Staff (Zielwahl über `ctx.promptDamageTarget`) hatten die Ausrüstungs-Instanz selbst als Quelle (Zone `support`). Leser, die eine Kreatur-Quelle
// an der Zone erkennen, hielten den Schlag für einen Kreaturentreffer: Explosivo's Sword, The Hands of Big Gwen, Skullmael's Greatsword, Future Tech Bazooka und Wavilion übersahen den Heldentreffer von Cecilia;
// Firewall, Toxic Trap und Mountain Tear River brannten/vergifteten die Ausrüstung ("Crusader's …", "Bamboo Staff") statt des angreifenden Helden.
// Fix: eigenes Quellobjekt des Helden (`attackerSourceOverride` + `actionDealDamage`).
// Beobachtung Basis: Crusader's: Explosivo/Gwen/Skullmael/Bazooka/Wavilion (Heldenziel) und Firewall/Toxic/Mountain Tear River (alle) lösen nicht aus; Bamboo Staff: Firewall/Toxic/Mountain Tear River.
// Aufruf: node docs/niche-tests/repro/W39/a-03-ausruestungs-effekte-quelle-ist-der-traeger-crusaders-und-bamboo-staff.js   (Exit 0 = korrekt; auf der Basis 72ed5383 Exit 1)
const H = require('./_helfer.js').H;
const P = require('./_pruefe.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
(async () => {
  const R = H.runner();
  await P.pruefe(R, { leser: ["Explosivo's Sword", "The Hands of Big Gwen", "Skullmael's Greatsword", "Future Tech Bazooka", "Wavilion", "Firewall", "Toxic Trap", "Mountain Tear River"], treiber: ['Echte Attack', 'Broghan', "Crusader's Arm-Cannon", "Crusader's Cutlass", "Crusader's Flintlock", "Crusader's Hookshot", 'Bamboo Staff', 'Javelin Throw'] });
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
