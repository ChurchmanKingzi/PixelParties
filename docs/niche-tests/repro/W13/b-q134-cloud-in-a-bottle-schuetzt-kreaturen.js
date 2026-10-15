'use strict';
// W13 / Q134 (M01-04) · Cloud in a Bottle: „when a target you control takes any damage. Halve any damage that target would take for the rest of the turn (including that damage)"
// Al: „Sollte auch für Creatures einsetzbar sein." Erwartung: (a) Kreatur halbiert den Schaden und trägt danach „Cloudy" (halbiert weiteren Schaden dieses Zuges);
// (b) Held wie bisher; (c) eine Kreatur, die der Reagierende NICHT kontrolliert, wird nicht angeboten. Exit 0 = korrekt.
const H = require('../../lib/h.js');
const CIB = 'Cloud in a Bottle';
(async () => {
  const R = H.runner();
  { const t = await H.fresh({ hand: [['Fireball'], [CIB]], hp: 800 });
    const c = t.put(1, 0, 0, H.INERT.creature);
    t.targetFn = (valid) => [valid.find(v => v.type === 'equip' && v.owner === 1 && v.heroIdx === 0 && v.slotIdx === 0).id];
    const r = await t.play(0, 'Fireball', { hero: 0 });
    R.check('(a) Fireball auf Kreatur: Cloud angeboten, Kreatur verliert nur 75 (125 übrig)', r === true && t.prompts.some(p => p.d.title === CIB) && c.counters.currentHp === 125, { r, hp: c.counters.currentHp });
    R.check('(a) Kreatur trägt „Cloudy", Karte verbraucht', !!c.counters.buffs?.cloudy && !t.pile(1, 'hand').includes(CIB), { buffs: Object.keys(c.counters.buffs || {}), hand: t.pile(1, 'hand') });
    await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Test', owner: 0, heroIdx: 0, controller: 0 }, c, 100, 'destruction_spell', { sourceOwner: 0, canBeNegated: true }));
    R.check('(a) weiterer Schaden desselben Zuges ebenfalls halbiert (125 − 50 = 75)', c.counters.currentHp === 75, c.counters.currentHp);
    R.check('(a) keine Engine-Fehler', t.errors.length === 0, t.errors); }
  { const t = await H.fresh({ hand: [['Fireball'], [CIB]], hp: 800 });
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    await t.play(0, 'Fireball', { hero: 0 });
    R.check('(b) Held: 150 → 75 (725 übrig)', t.hp(1, 0) === 725, t.hp(1, 0)); }
  { const t = await H.fresh({ hand: [[], [CIB]], hp: 800 });
    const eigene = t.put(0, 0, 0, H.INERT.creature);   // Kreatur des Gegners (Sitz 0) – gehört nicht dem Cloud-Besitzer (Sitz 1)
    await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Test', owner: 1, heroIdx: 0, controller: 1 }, eigene, 100, 'destruction_spell', { sourceOwner: 1, canBeNegated: true }));
    R.check('(c) fremde Kreatur: kein Angebot, voller Schaden (100)', !t.prompts.some(p => p.d.title === CIB) && eigene.counters.currentHp === 100, { prompts: t.prompts.map(p => p.d.title), hp: eigene.counters.currentHp }); }
  R.finish();
})();
