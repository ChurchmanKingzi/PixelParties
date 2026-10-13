'use strict';
// A02-deepsea-28 · Slippery Pengu: eine geliehene Gegnerkreatur wird als Partner angeboten und auf dem FALSCHEN Brett verschoben
//
// Kartentext (Pengu): „When this Creature is moved into a different Hero's Support Zone, you may choose another Creature you
// control, except "Slippery Pengu". Your opponent chooses a free Support Zone of one of your adjacent undefeated Heroes, if
// possible. Immediately move that Creature into that Support Zone."
// Aufbau: Seat 0: Pengu (Held 0), eigene Kreatur (Held 2); Seat 1: Deepsea Siren in Held 1 / Slot 0, von Seat 0 geliehen
//   (Kontrolle bei Seat 0, z. B. durch Deepsea Succubus im selben Zug). Pengu wird per Slippery-Weg (Ice/Skates/Zugbeginn) nach Held 1 bewegt.
// Beobachtet: `eligiblePartnerCreatures` (slippery-pengu.js) filtert nach Kontrolle, trägt die Koordinaten der GEGNER-Zone aber mit
//   `owner: pi` ein (kollidiert mit meiner Zone Held 1 / Slot 0); `adjacentFreeUndefeatedZones` prüft die freien Zonen auf MEINEM Brett,
//   `moveSlipperyCreature` verschiebt die Kreatur dann auf ihrem physischen Brett (dem des Gegners) – das gewählte Ziel meiner Seite
//   wird nie erreicht, die Kreatur landet an gleichen Koordinaten auf dem Gegnerbrett (hier Held 0 / Slot 0 des Gegners).
// Erwartung (eine der Lesarten): die geliehene Kreatur wird gar nicht angeboten („adjacent Heroes" der Kreatur sind Gegnerhelden, nicht
//   „your Heroes"); oder sie wandert in die vom Gegner gewählte Zone MEINER Seite. Nie: Verschiebung auf dem Gegnerbrett an eine Koordinate,
//   die für meine Seite ausgewählt wurde.
const H = require('../../lib/h.js');
const SH = require('../../../../cards/effects/_slippery-shared.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [[], []] });
  const pengu = t.put(0, 0, 0, 'Slippery Pengu'); pengu.turnPlayed = 1;
  const x = t.put(1, 1, 0, 'Deepsea Siren', { controller: 0 }); x.turnPlayed = 1; x.stolenBy = 0;
  const own = t.put(0, 2, 0, H.INERT.creature); own.turnPlayed = 1;
  const seen = {};
  t.targetFn = (valid) => { seen.valid = valid.map(v => v.cardName + '@owner' + v.owner + ':h' + v.heroIdx + ':s' + v.slotIdx); const v = valid.find(v => v.cardName === 'Deepsea Siren') || valid[0]; return [v.id]; };
  t.script.push({ match: d => d.type === 'zonePick', answer: (d) => { const z = d.zones[0]; seen.zone = { heroIdx: z.heroIdx, slotIdx: z.slotIdx, owner: z.owner }; return { heroIdx: z.heroIdx, slotIdx: z.slotIdx, owner: z.owner }; } });
  await t.run(() => SH.moveSlipperyCreature(t.engine, 0, pengu, 1, 0));
  R.note('angebotene Partner', seen.valid || null);
  R.note('Zonenwahl des Gegners', seen.zone || null);
  const board1 = t.gs.players[1].supportZones.map(h => h.map(z => z[0] || null));
  const board0 = t.gs.players[0].supportZones.map(h => h.map(z => z[0] || null));
  const angeboten = (seen.valid || []).some(v => /Siren/.test(v));
  const aufMeinemBrett = board0.some(h => h.includes('Deepsea Siren'));
  R.check('Die geliehene Kreatur wird entweder nicht angeboten oder landet in der gewählten Zone MEINER Seite', !angeboten || aufMeinemBrett, { angeboten, board0, board1 });
  R.check('Zustand sauber', t.audit().length === 0, t.audit());
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
