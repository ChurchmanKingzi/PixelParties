'use strict';
// R02-16 · Spectral Armor: „when a target you control would take any damage" – für eine KREATUR wird die Reaktion nie angeboten
// Kartentext: „Play this card immediately when a target you control would take any damage. Halve that damage (rounded up)."
// Vergleich: Strong Shield („when a target you control would take 300 or more damage") wird für Kreaturen angeboten (Kontrolle unten). Verwandt: M01-04 (Cloud in a Bottle, gleiche Lücke).
// Aufbau: Sitz 1: Spectral Armor auf der Hand (Held 0 mit Magic Arts 1 + Support Magic 1), Kreatur (1000 HP) in Support Zone 0 von Held 0. Sitz 0 spielt Burning Finger (100 Schaden) auf (a) den Helden, (b) die Kreatur.
// Erwartet: (a) und (b): Frage „Spectral Armor", Schaden 50.
// Beobachtet: (a) ✓ 750 HP. (b) keine Frage, die Kreatur verliert die vollen 100 (900 HP), Spectral Armor bleibt auf der Hand.
// Ursache: `spectral-armor.js` kennt nur Heldenziele: `_collectOwnedHeroTargets` (Post-Target-Fenster) und `isPreDamageReaction` (Held); für Kreaturenschaden gibt es keinen Zweig (Gegenstück: `strong-shield.js` hat einen).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const ziel of ['(a) Held', '(b) Kreatur']) {
    const t = await H.fresh({ hand: [['Burning Finger'], ['Spectral Armor']], hp: 800 });
    t.setAbilities(1, 0, [['Magic Arts'], ['Support Magic'], []]);
    t.grantFor(0, 0, 'Burning Finger');
    const c = t.put(1, 0, 0, H.INERT.big);
    t.targetFn = (valid) => {
      const v = ziel.startsWith('(a)') ? valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0) : valid.find(x => x.type === 'equip' && x.owner === 1 && x.heroIdx === 0 && x.slotIdx === 0);
      return [(v || valid[0]).id];
    };
    t.policy.confirm = true;
    await t.play(0, 'Burning Finger', { hero: 0, noGrant: true });
    const gefragt = t.prompts.some(p => p.d.title === 'Spectral Armor');
    const schaden = ziel.startsWith('(a)') ? 800 - t.hp(1, 0) : 1000 - (c.counters.currentHp ?? 1000);
    R.check(`${ziel}: Spectral Armor wird angeboten`, gefragt, t.prompts.map(p => p.d.title));
    R.check(`${ziel}: Schaden halbiert (50)`, schaden === 50, schaden);
    R.check(`${ziel}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  R.finish();
})();
