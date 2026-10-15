'use strict';
// C02-creatures-05 · Drill Sergeant, gestohlen: „the corresponding Hero" wird auf die Spalte mit gleichem INDEX des Diebes abgebildet (Stufe C)
// Kartentext: „You may once per turn choose a level 1 or lower Creature from your hand and place it into a free Support Zone of the corresponding Hero."
// Konvention (z. B. Demon's Gate, demon-s-gate.js ~Z. 118): „Wirtsheld = Held der Spalte auf der BRETTSEITE der Kreatur" (`ctx.cardHeroOwner`, `physicalSide`).
// Aufbau: Drill Sergeant liegt auf Seite 0 unter Held 1; Sitz 1 hat ihn per `actionStealCreature` gestohlen; Sitz 1 hat einen Dummy auf der Hand.
// Schritte: Sitz 1 aktiviert den gestohlenen Sergeant (Aufruf wie ein Mensch: `doActivateCreatureEffect` mit `charmedOwner` = Brettseite 0), wählt den Dummy.
// Beobachtet: Der Dummy landet auf Seite 1, Held 1 (EIGENER Held des Diebes mit gleichem Index) – weder beim Wirtsheld des Sergeants (Seite 0 / Held 1)
//   noch bei einer Wahl des Diebes. Grund: `drill-sergeant.js` `targetZones` = `engine.getFreeSupportZones(pi)` (Kontrolleur-Seite) gefiltert auf `ctx.cardHeroIdx`.
// Strenge Lesart (Wirtsheld = Held unter dem der Sergeant liegt): ✗ (hier geprüft). Lockere Lesart („ein Held des Kontrolleurs"): ✓.
// ENTSCHIEDEN (Al, Welle 11, Q74 „a"): strenge Lesart gilt - der gestohlene Sergeant legt beim Helden, unter dem er liegt (Gegnerseite). Repro prüft das (✓ seit W11c).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [[], [H.INERT.creature]] });
  const ds = t.put(0, 1, 0, 'Drill Sergeant'); ds.turnPlayed = 1;
  t.engine.actionStealCreature(1, ds);
  t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: H.INERT.creature }) });
  t.script.push({ match: d => d.type === 'zonePick', answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx }) });
  t.gs.activePlayer = 1; t.phase(2);
  await t.run(() => t.host.doActivateCreatureEffect(t.room, 1, { heroIdx: 1, zoneSlot: 0, charmedOwner: 0 }));
  const p = t.inst(c => c.name === H.INERT.creature && c.zone === 'support')[0];
  R.note('Landeplatz [Brettseite, Held, Zone]', p && [p.owner, p.heroIdx, p.zoneSlot]);
  R.check('Dummy liegt bei dem Helden, unter dem der Sergeant liegt (Seite 0, Held 1)', !!p && p.owner === 0 && p.heroIdx === 1, p && [p.owner, p.heroIdx, p.zoneSlot]);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
