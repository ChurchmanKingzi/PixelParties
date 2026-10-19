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
  const meteor = t.pile(0, 'discardPile').includes('Meteor Crash');
  // W16g: der Kopf nennt ZWEI zulässige Ausgänge (Folgezauber verbraucht eine Mission-Ladung ODER wird als „andere“ Zusatzaktion gar nicht angeboten).
  // Geprüft wird deshalb die Grenze selbst: VPC + Folgezauber + weitere Zauber = höchstens 2 Zusatzaktionen unter Mission.
  const hp0 = t.hp(1, 0);
  const r2 = await t.play(0, 'Rockfall', { hero: 0, noGrant: true, keepActions: true, phase: 4 });
  const hp1 = t.hp(1, 0);
  const r3 = await t.play(0, 'Rockfall', { hero: 0, noGrant: true, keepActions: true, phase: 4 });
  const rockfaelle = (r2 === true && hp1 < hp0 ? 1 : 0) + (r3 === true && t.hp(1, 0) < hp1 ? 1 : 0);
  const zusatz = (r === true ? 1 : 0) + (meteor ? 1 : 0) + rockfaelle;
  R.check('VPC als Zusatzaktion gespielt', r === true && t.pile(0, 'discardPile').includes('Victory Phoenix Cannon'), { r, ablage: t.pile(0, 'discardPile') });
  R.check('Mission-Grenze: VPC + Folgezauber + weitere Zauber = höchstens 2 Zusatzaktionen', zusatz <= 2, { vpc: r, meteor, rockfaelle, zusatz });
  R.check('die zwei Mission-Zusatzaktionen sind verbraucht (Ladung 0)', t.gs.players[0]._missionCharges === 0, t.gs.players[0]._missionCharges);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
