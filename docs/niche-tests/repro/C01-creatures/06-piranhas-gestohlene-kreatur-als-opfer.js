'use strict';
// C01-creatures-06 · 500 Piranhas in a Monster Suit mit einer vom Gegner gestohlenen EIGENEN Kreatur als Opfer
// Kartentext: „Choose a Creature your opponent controls and defeat it to play this card. Place this Creature into the Support Zone the defeated Creature occupied."
// Aufbau: Sitz 1 hat meine Kreatur (Sitz 0, Held 1, Slot 2) gestohlen (actionStealCreature(1, ...): physisch weiter bei mir, controller 1). Hand [Piranhas].
//   Teil A: Gegner-Zone Held 1 / Slot 2 ist belegt. Teil B: diese Zone ist frei.
// Erwartung: Die gestohlene Kreatur ist eine legale Wahl („a Creature your opponent controls"). Wird sie besiegt, kommt die Piranhas in genau DIE Zone,
//   die sie belegte (Held 1 / Slot 2 auf MEINER Seite) – oder, wenn man das fuer unerwuenscht haelt, wird sie gar nicht erst angeboten. Auf keinen Fall darf das Opfer
//   fallen, waehrend die Karte nicht gespielt wird (Kosten bezahlt, kein Effekt).
// Beobachtet: A: Opfer besiegt, Piranhas bleibt auf der Hand (log `piranhas_fizzle: slot_reoccupied`, Gegnerzone war belegt). B: Opfer besiegt, die Piranhas landet in der
//   gleichnamigen Zone der GEGNER-Seite (Held 1 / Slot 2 des Gegners), nicht dort, wo das Opfer lag.
// Ursache: cards/effects/500-piranhas-in-a-monster-suit.js `beforeSummon`: `destHi/destSlot` kommen von der Opfer-Instanz, die Platzierung (`engine.summonCreature(FULL_NAME, oi, destHi, destSlot)`)
//   und die Pruefung `slotAfter` laufen aber immer auf `gs.players[oi]` – `_validVictims` filtert nach `controller`, die Brettseite der Instanz (`engine.physicalSide`) kann abweichen.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const P = '500 Piranhas in a Monster Suit';
  for (const belegt of [true, false]) {
    R.section(`Gegner-Zone Held 1/Slot 2 ${belegt ? 'belegt' : 'frei'}`);
    const t = await H.fresh({ hand: [[P], []] });
    const gs = t.gs, ps = gs.players[0];
    const meine = t.put(0, 1, 2, H.INERT.creature);
    t.engine.actionStealCreature(1, meine);
    if (belegt) t.put(1, 1, 2, H.INERT.big);
    t.targetFn = (valid) => [valid.find(v => v.cardName === H.INERT.creature).id];
    await t.play(0, P);
    const pir = t.find(P, 'support');
    const opferWeg = meine.zone !== 'support';
    R.check('Opfer wurde besiegt  =>  Piranhas wurde auch gespielt (Kosten nicht umsonst bezahlt)', !opferWeg || !!pir, { opferWeg, hand: ps.hand });
    R.check('Piranhas steht in der Zone des Opfers (meine Seite, Held 1, Slot 2)', !!pir && t.engine.physicalSide(pir) === 0 && pir.heroIdx === 1 && pir.zoneSlot === 2,
      pir && { seite: t.engine.physicalSide(pir), held: pir.heroIdx, slot: pir.zoneSlot });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
