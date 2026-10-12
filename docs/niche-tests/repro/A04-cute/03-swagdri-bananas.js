'use strict';
// A04-cute-03 · Swagdri spielt Golden Bananas von der Stack-Spitze – der Gold-Gewinn verpufft
//
// Kartentexte: Swagdri: "Once per turn, if the top card of your Coolness Stack is an Artifact, you may immediately play it
//   without paying its Cost as if it was part of your hand. If you do, delete the Artifact if it would be sent to the discard pile."
//   Golden Bananas: "Gain 4 Gold three times."
// Erwartung: Spieler hat danach 12 Gold mehr; die Bananas liegen im Gelöscht-Stapel.
// Beobachtet: Bananas im Gelöscht-Stapel, aber das Gold ist unverändert (Gewinn von 12 wird zurückgesetzt).
// Ursache: cards/effects/swagdri-forger-of-coolness.js (Nicht-Ausrüstungs-Zweig, ~Z. 232-246) setzt "kostenlos spielen"
//   durch Gold-Sichern/Wiederherstellen um: `ps.gold = origGold` nach `script.resolve` löscht JEDE Goldänderung des Artefakts,
//   auch Gewinne (und Ausgaben/Gewinne der von den Bananas ausgelösten Monkees).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ gold: [10, 100], deck: [[H.INERT.creature, H.INERT.creature, H.INERT.creature], []] });
  t.putArea(0, 'Wowhalla, the Hall of the Cool');
  const sw = t.put(0, 0, 0, 'Swagdri, Forger of Coolness'); sw.turnPlayed = 0;
  const ps = t.gs.players[0];
  for (const n of ['Cute Bunny', 'Golden Bananas']) { ps.coolnessStack.push(n); t.engine._trackCard(n, 0, 'coolnessStack'); }
  t.gs.activePlayer = 0; t.phase(2);
  const g0 = ps.gold;
  const r = await t.activateCreature(0, 0, 0);
  R.check('Swagdri-Effekt ausgeführt', r === true, r);
  R.check('Bananas im Gelöscht-Stapel', t.pile(0, 'deletedPile').includes('Golden Bananas'), t.pile(0, 'deletedPile'));
  R.check('Spieler hat 12 Gold mehr (3 × 4)', ps.gold === g0 + 12, { vorher: g0, nachher: ps.gold });
  R.check('keine Engine-Fehler', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
