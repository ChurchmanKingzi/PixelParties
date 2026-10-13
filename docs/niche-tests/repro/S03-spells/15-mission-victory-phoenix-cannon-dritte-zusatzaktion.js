'use strict';
// S03-15 · Mission of the Light Brigade + Victory Phoenix Cannon: der Folgezauber der VPC umgeht die Zwei-Zusatzaktionen-Grenze
// Kartentexte: Mission: „You may perform up to 2 additional Actions this turn. You cannot perform any other additional Actions this turn."
//   Victory Phoenix Cannon: „You may then immediately use a level 1 or lower Destruction Magic Spell from your hand with the user as an additional Action."
// Aufbau: Held 0 mit Destruction Magic 3 + Support Magic 4; Hand [Mission, VPC, Meteor Crash, Rockfall, Rockfall]; Gegner 800 HP. Reihenfolge: Mission (1. Aktion der Action Phase),
//   VPC (Zusatzaktion 1, Ladung 2→1), VPC-Folgezauber Meteor Crash (Zusatzaktion 2), danach Rockfall (Zusatzaktion 3?).
// Erwartet: Mission erlaubt höchstens 2 Zusatzaktionen: VPC (1) + Folgezauber (2) ⇒ Rockfall ist nicht mehr spielbar (und die Ladung ist nach dem Folgezauber 0) –
//   oder der Folgezauber wird gar nicht erst angeboten, weil jede „andere" Zusatzaktion gesperrt ist.
// Beobachtet: Der Folgezauber läuft über `_castSpellImmediately(… alsZusatzaktion: true)` ohne Mission-Ladung (Ladungen nach VPC + Folgezauber: 1); Rockfall wird als dritte Zusatzaktion gespielt (Ladung 0).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Mission of the Light Brigade', 'Victory Phoenix Cannon', 'Meteor Crash', 'Rockfall', 'Rockfall'], []], hp: 800 });
  t.setAbilities(0, 0, [['Destruction Magic', 'Destruction Magic', 'Destruction Magic'], ['Support Magic', 'Support Magic', 'Support Magic', 'Support Magic'], []]);
  t.script.push({ match: d => d.type === 'cardGallery' && /Victory/.test(d.title || ''), answer: () => ({ cardName: 'Meteor Crash' }) });
  t.targetFn = (valid) => { const v = valid.find(q => q.type === 'hero' && q.owner === 1 && q.heroIdx === 0); return [v.id]; };
  t.policy.confirm = true;
  const rm = await t.play(0, 'Mission of the Light Brigade', { hero: 0, noGrant: true, phase: 3 });
  R.check('Mission gespielt (2 Ladungen)', rm === true && t.gs.players[0]._missionCharges === 2, { rm, ladungen: t.gs.players[0]._missionCharges });
  const r = await t.play(0, 'Victory Phoenix Cannon', { hero: 0, noGrant: true, keepActions: true, phase: 4 });
  R.check('VPC als Zusatzaktion gespielt, Folgezauber Meteor Crash gewirkt', r === true && t.pile(0, 'discardPile').includes('Meteor Crash'), { r, ablage: t.pile(0, 'discardPile') });
  R.check('nach VPC + Folgezauber sind beide Mission-Zusatzaktionen verbraucht (Ladung 0)', t.gs.players[0]._missionCharges === 0, t.gs.players[0]._missionCharges);
  const hp0 = t.hp(1, 0);
  const r2 = await t.play(0, 'Rockfall', { hero: 0, noGrant: true, keepActions: true, phase: 4 });
  R.check('Rockfall als DRITTE Zusatzaktion ist nicht spielbar', r2 === false && t.hp(1, 0) === hp0, { r2, hp: t.hp(1, 0), vorher: hp0 });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
