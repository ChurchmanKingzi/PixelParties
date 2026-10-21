'use strict';
// W39a · a-05 · Alluring Light: die Fenster der Opferwahl (Surprises, Hand-Reaktionen) sehen den GEZWUNGENEN Helden als Angreifer
// Auftrag (Al, 22.10.2026): "Es gibt viele Karten, die triggern, wenn eine Attack ausgeführt wird … Reagieren die auch ALLE schon auf Broghan und co?" — Regel (W32a/W34a/W35a): Effekte, die als Attack eines
// Helden zählen, lösen JEDEN Attack-Leser genauso aus wie eine echte Attack. Matrix: Leser × Quellen (Referenz "Echte Attack"; Broghan, Brackle, Arthor, Heragas, Kohta, Javelin Throw, Sword in a Bottle,
// Crusader's ×4, Bamboo Staff, Sacrificial Dagger, Infected Greatmaw, Alluring Light, Duel) × beide Sitze × Heldenziel/Kreaturenziel (`_helfer.js`, `_leser.js`, `_pruefe.js`).
// Ursache: die Opferwahl nannte als Quelle die Karteninstanz des Spielers (Held, der Light spielt). "Der Angreifer" war damit für Booby Trap, Firewall, Toxic Trap, Mountain Tear River, Frost Rune, Spike Trap,
// Tharxian Horse, Crimson Web ... der EIGENE Held (er bekam Schaden/Brand/Frost/Gift; der gezwungene Held blieb verschont). Phalanx Pike ("Attacks do not trigger Surprises") und Invisibility Cloak ("Attack or
// Spell", Opferwahl ohne Schadenstyp) sahen den provozierten Angriff nicht.
// Fix: `sourceCard: attackSource` (gezwungener Held mit Stempel) in der Opferwahl; Phalanx-Pike-Tor und Invisibility Cloak lesen den Stempel (`_zaehltAlsArt`).
// Beobachtung Basis: Booby Trap, Firewall, Toxic Trap, Mountain Tear River, Frost Rune, Phalanx Pike, Invisibility Cloak lösen bei Alluring Light nicht (richtig) aus.
// Aufruf: node docs/niche-tests/repro/W39/a-05-alluring-light-opferwahl-quelle-ist-der-gezwungene-held.js   (Exit 0 = korrekt; auf der Basis 72ed5383 Exit 1)
const H = require('./_helfer.js').H;
const P = require('./_pruefe.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
(async () => {
  const R = H.runner();
  await P.pruefe(R, { leser: ["Bluff", "Booby Trap", "Crimson Web", "Firewall", "Flooding", "Frost Rune", "Glass Wall", "Jumper Spider", "Mountain Tear River", "Spike Trap", "Tharxian Horse", "Toxic Trap", "Spider Avalanche", "Jumpscare", "Phalanx Pike", "Invisibility Cloak", "Empty Armor (Umleitung)", "Escape", "Fireshield", "Spiky Armor", "Challenge", "Martyry", "Anti-Magnet", "Test Flight", "Future Tech Escape Device"], treiber: ['Alluring Light', 'Echte Attack'] });
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
