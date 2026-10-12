'use strict';
// A04-cute-04 · Swagdri rüstet "Lunatic Cycle - Crescent Moon" aus, obwohl kein New Moon auf dem Brett liegt
//
// Kartentexte: Swagdri: "… play it without paying its Cost as if it was part of your hand."
//   Crescent Moon: "You can only play this card while there is at least 1 'Lunatic Cycle - New Moon' on the board."
// Erwartung: Nur die KOSTEN entfallen; die Spielbedingung der Karte gilt weiter → ohne New Moon keine Ausrüstung
//   (Swagdri-Aktivierung nicht möglich oder wirkungslos, Karte bleibt oben auf dem Stack).
// Beobachtet: Crescent Moon wird ausgerüstet und aus dem Stack genommen; Spielbedingung (canEquipToHero) wird nicht geprüft.
// Ursache: cards/effects/swagdri-forger-of-coolness.js Ausrüstungs-Zweig (canActivateCreatureEffect ~Z. 62-72, onCreatureEffect
//   ~Z. 112-175) baut die Ziele selbst und ruft weder `canEquipToHero` noch `canPlayCard` des Artefakts.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ deck: [[H.INERT.creature], []] });
  t.putArea(0, 'Wowhalla, the Hall of the Cool');
  const sw = t.put(0, 0, 0, 'Swagdri, Forger of Coolness'); sw.turnPlayed = 0;
  const ps = t.gs.players[0];
  for (const n of ['Lunatic Cycle - Crescent Moon']) { ps.coolnessStack.push(n); t.engine._trackCard(n, 0, 'coolnessStack'); }
  t.gs.activePlayer = 0; t.phase(2);
  await t.activateCreature(0, 0, 0);
  const eq = t.find('Lunatic Cycle - Crescent Moon', 'support');
  R.check('Crescent Moon ist NICHT ausgerüstet (kein New Moon auf dem Brett)', !eq, { ausgeruestet: !!eq, stack: ps.coolnessStack.slice() });
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
