'use strict';
// M01-04 · Cloud in a Bottle schützt nur Helden, nicht Kreaturen („a target you control")
// Kartentext: „Play this card immediately when a target you control takes any damage. Halve any damage that target would take for the rest of the turn (including that damage) (rounded up)."
// Skriptkommentar (cloud-in-a-bottle.js, `_collectOwnedHeroTargets`): „CIB's text 'any target you control' technically includes Creatures, but the current implementation is hero-only".
// Aufbau: Sitz 1 hat eine 200-HP-Kreatur (ZZ Dummy) und Cloud in a Bottle auf der Hand; Sitz 0 trifft die Kreatur (a) per Fireball, (b) direkt per `actionDealCreatureDamage` mit 100.
// Erwartet: Cloud wird angeboten; die Kreatur verliert nur die Hälfte (Fireball 150 → 75 → 125 HP übrig).
// Beobachtet: kein Angebot (kein Prompt), Karte bleibt auf der Hand, Kreatur verliert die vollen 150 (50 HP übrig). Der Held-Fall (Kontrolle) wird angeboten.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  {
    const t = await H.fresh({ hand: [['Fireball'], ['Cloud in a Bottle']], hp: 800 });
    const c = t.put(1, 0, 0, H.INERT.creature);
    t.targetFn = (valid) => [valid.find(v => v.type === 'equip' && v.owner === 1 && v.heroIdx === 0 && v.slotIdx === 0).id];
    const r = await t.play(0, 'Fireball', { hero: 0 });
    R.check('Fireball auf die Kreatur gespielt', r === true, r);
    R.check('Sitz 1 wurde gefragt, ob Cloud in a Bottle aktiviert wird', t.prompts.some(p => p.d.type === 'confirm' && p.d.title === 'Cloud in a Bottle'), t.prompts.map(p => p.d.title));
    R.check('Kreatur verliert nur die Hälfte (125 HP übrig)', c.counters.currentHp === 125, c.counters.currentHp);
  }
  {
    const t = await H.fresh({ hand: [[], ['Cloud in a Bottle']], hp: 800 });
    const c = t.put(1, 0, 0, H.INERT.creature);
    await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Test', owner: 0, heroIdx: 0, controller: 0 }, c, 100, 'destruction_spell', { sourceOwner: 0, canBeNegated: true }));
    R.check('direkter Kreaturenschaden 100 → nur 50 (halbiert)', c.counters.currentHp === 150, c.counters.currentHp);
  }
  R.finish();
})();
