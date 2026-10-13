'use strict';
// F01-artifacts-10 · Deepsea Idol: Auslöser zählt Kreaturen der Brettseite (`inst.owner`), die Wirkung schützt nach Kontrolle (`inst.controller`)
// Kartentext: „Play this card immediately when 2 or more Creatures you control would take damage from a single source. Negate all effects that damage source would have on Creatures you control (including damage)."
// Aufbau: Sitz 1 hält Deepsea Idol (100 Gold). Sitz 0 spielt Book of Doom (50 Schaden, Kosten × Ziele) auf zwei Kreaturen.
//  (i)  Beide Ziele stehen in der Spalte von Sitz 1; die zweite hat Sitz 0 gestohlen (`controller` = 0). Sitz 1 KONTROLLIERT nur 1 der beiden.
//       Erwartung: Idol wird nicht angeboten (nur 1 „Creature you control" betroffen). Beobachtet: Idol wird angeboten/gespielt (Kosten 4 Gold + Karte) und rettet nur die eigene Kreatur.
//  (ii) Sitz 1 kontrolliert beide Ziele: eine steht in der eigenen Spalte, eine ist von Sitz 1 aus Spalte 0 gestohlen (`controller` = 1, `owner` = 0).
//       Erwartung: Idol wird angeboten und negiert den Schaden an BEIDEN. Beobachtet: kein Angebot, beide nehmen 50 Schaden.
// Ursache: `_engine.js` `_checkCreatureDamageBatchReactions` (Z. 34435-34437): `ownDmgEntries = entries.filter(… e.inst.owner === pi)`; `deepsea-idol.js` Z. 74 schützt dagegen `(controller ?? owner) === pi`.
const H = require('../../lib/h.js');
const hpOf = (c) => c.counters.currentHp ?? 1000;
(async () => {
  const R = H.runner();
  {   // (i)
    const t = await H.fresh({ hand: [['Book of Doom'], ['Deepsea Idol']], gold: [100, 100] });
    const mine = t.put(1, 0, 0, H.INERT.big);
    const stolenByOpp = t.put(1, 1, 0, H.INERT.big);
    await t.engine.actionStealCreature(0, stolenByOpp);
    t.policy.confirm = true;
    t.targetFn = (valid) => valid.filter(v => v.type === 'equip' && v.owner === 1).map(v => v.id);
    await t.play(0, 'Book of Doom', { hero: 0 });
    const idolGespielt = t.pile(1, 'discardPile').includes('Deepsea Idol');
    R.check('(i) Idol nicht gespielt, wenn Sitz 1 nur 1 der 2 getroffenen Kreaturen kontrolliert', !idolGespielt, { idolGespielt, schadenEigene: 1000 - hpOf(mine), schadenGestohlene: 1000 - hpOf(stolenByOpp) });
    R.check('(i) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {   // (ii)
    const t = await H.fresh({ hand: [['Book of Doom'], ['Deepsea Idol']], gold: [100, 100] });
    const a = t.put(1, 0, 0, H.INERT.big);
    const c = t.put(0, 0, 0, H.INERT.big);
    await t.engine.actionStealCreature(1, c);
    t.policy.confirm = true;
    t.targetFn = (valid) => valid.filter(v => v.type === 'equip' && ((v.owner === 1 && v.heroIdx === 0 && v.slotIdx === 0) || (v.owner === 0 && v.heroIdx === 0 && v.slotIdx === 0))).map(v => v.id);
    await t.play(0, 'Book of Doom', { hero: 0 });
    const idolGespielt = t.pile(1, 'discardPile').includes('Deepsea Idol');
    R.check('(ii) Idol wird gespielt, wenn Sitz 1 beide getroffenen Kreaturen kontrolliert (eine steht in der Gegenspalte)', idolGespielt, { schadenA: 1000 - hpOf(a), schadenC: 1000 - hpOf(c), idolGespielt });
    R.check('(ii) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
