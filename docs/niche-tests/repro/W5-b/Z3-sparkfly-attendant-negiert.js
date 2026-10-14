'use strict';
// W5b-Z3 (zu A05-11 Teil b) · Sparkfly Attendant: „ein negierter Attendant gibt keinen Schutz mehr." (Al, Welle 5)
// Kartentext: „While you control this Creature, "Sparkfly Queen" Creatures you control are unaffected by your opponent's cards and effects."
// Erwartung: Attendant negiert -> die Queen nimmt Gegnerschaden und Gegnereffekte; endet die Negierung -> der Schutz gilt sofort wieder; zweiter, nicht negierter Attendant hält den Schutz.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const schlag = (t, q) => t.run(() => t.engine.actionDealCreatureDamage({ name: 'x', owner: 1 }, q, 20, 'creature', { sourceOwner: 1 }));
  const hp = (q) => q.counters.currentHp ?? 150;
  let t = await H.fresh({});
  const att = t.put(0, 0, 0, 'Sparkfly Attendant'); att.turnPlayed = 1;
  const q = t.put(0, 0, 1, 'Sparkfly Queen'); q.turnPlayed = 1;
  await t.run(() => t.engine.runHooks('onPlay', { _onlyCard: att, playedCard: att, cardName: att.name, zone: 'support', heroIdx: 0, zoneSlot: 0 }));
  let h0 = hp(q); await schlag(t, q);
  R.check('Aufbau: mit aktivem Attendant nimmt die Queen keinen Gegnerschaden', hp(q) === h0, hp(q));
  await t.run(() => t.engine.actionNegateCreature(att, 'test'));
  h0 = hp(q); await schlag(t, q);
  R.check('negierter Attendant: Queen nimmt Gegnerschaden', hp(q) < h0, hp(q));
  R.check('negierter Attendant: Gegnereffekte treffen die Queen (isOppEffectImmuneFrom false)', !t.engine.isOppEffectImmuneFrom(q, { name: 'x', owner: 1 }));
  delete att.counters.negated;   // Negierung endet
  h0 = hp(q); await schlag(t, q);
  R.check('Negierung beendet: Schutz sofort wieder da', hp(q) === h0 && t.engine.isOppEffectImmuneFrom(q, { name: 'x', owner: 1 }), hp(q));
  // zweiter Attendant, nicht negiert
  const att2 = t.put(0, 1, 0, 'Sparkfly Attendant'); att2.turnPlayed = 1;
  await t.run(() => t.engine.actionNegateCreature(att, 'test'));
  h0 = hp(q); await schlag(t, q);
  R.check('ein Attendant negiert, der andere nicht: Schutz bleibt', hp(q) === h0, hp(q));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
