'use strict';
// C03-creatures-19 · Monster Nest legt Land Sharks, obwohl die Nachbarzonen belegt sind – Hai mit nur EINER Zone
// Kartentext Land Sharks: „This Creature occupies 3 Support Zones." (Skript: canSummon verlangt alle drei Plätze des Gastgebers frei, `_multizone-shared`)
// Kartentext Nest: „…choose a level 3 or lower Creature from your deck and place it on top of this card. This counts as that Creature being summoned."
// Aufbau: Sitz 0 / Held 0: Monster Nest (Slot 0, alt), ZZ Dummy in Slot 1 und 2; Deck: Land Sharks + Füller. Nest aktivieren, Land Sharks wählen.
// Erwartung: Land Sharks ist nicht wählbar/platzierbar (3 Zonen sind nicht frei), oder die Nachbarn werden geräumt/blockiert – kein 1-Zonen-Hai neben fremden Kreaturen.
// Beobachtet: Der Hai wird auf das Nest gelegt (Slot 0), die beiden Dummys bleiben in Slot 1/2: eine Land Sharks, die 3 Zonen "belegt", belegt nur 1.
//   (Gegenprobe: bei freien Nachbarzonen setzt `claimZones` die zwei `_ZoneBlocked`-Platzhalter – korrekt.)
// Ursache: `summonCreatureWithHooks(…, { coverNested: true })` (monster-nest.js) umgeht `canSummon`; `_multizone-shared.claimZones` setzt nur Platzhalter in leere Zonen
//   (`gesetzt === 0` ⇒ stilles `false`).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ deck: [['Land Sharks', 'Fireball', 'Slow', 'Fireball', 'Slow'], []] });
  t.grantFor(0, 0, 'Land Sharks'); t.grantFor(0, 0, 'Monster Nest');
  const nest = t.put(0, 0, 0, 'Monster Nest'); nest.turnPlayed = 1;
  t.put(0, 0, 1, H.INERT.creature); t.put(0, 0, 2, H.INERT.creature);
  let angeboten = null;
  t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Monster Nest', answer: (d) => { angeboten = (d.cards || []).map(c => c.name); return { cardName: 'Land Sharks' }; } });
  t.gs.activePlayer = 0; t.phase(2);
  await t.run(() => t.host.doActivateCreatureEffect(t.room, 0, { heroIdx: 0, zoneSlot: 0 }));
  const hai = t.inst(c => c.name === 'Land Sharks' && c.zone === 'support')[0];
  const nachbarn = t.inst(c => c.zone === 'support' && c.name === H.INERT.creature && c.heroIdx === 0).length;
  t.say('Galerie: ' + JSON.stringify(angeboten) + ' · Hai auf dem Brett: ' + !!hai + ' · Dummys daneben: ' + nachbarn);
  R.check('Land Sharks steht nicht mit nur einer Zone neben zwei fremden Kreaturen', !(hai && nachbarn === 2), { hai: !!hai, nachbarn, zonen: JSON.stringify(t.gs.players[0].supportZones[0]) });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
