'use strict';
// M02-01 · Stranglehold zählt nur 5 von 17 negativen Status
// Kartentext: „Choose a target and deal 50 damage to it times the number of negative status effects it is inflicted with."
// Erwartung: jeder in der Engine als negativ geführte Status (`getNegativeStatuses()` in _hooks.js, 17 Stück) zählt als ein Statuseffekt.
//   Insbesondere Bleeding, Bound, Blinded (Smoke Vial / Trunk Sand), Nulled, Webbed, Cursed, Frightened … sind „negative status effects".
// Beobachtet: `stranglehold.js` kennt nur ['frozen','stunned','burned','poisoned','negated'] (NEGATIVE_STATUSES, Z. 19). Alle anderen zählen 0 ⇒ 0 Schaden.
//   Kreaturen: gleiche Liste gegen `inst.counters` – Blinded (Trunk Sand), Bleeding, Bound, Nulled, Webbed, Magic Silenced zählen nicht.
const H = require('../../lib/h.js');
const { getNegativeStatuses } = require('../../../../cards/effects/_hooks.js');
(async () => {
  const R = H.runner();
  const heroT = (seat, hi) => (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === seat && x.heroIdx === hi); return v ? [v.id] : null; };
  const creatT = (seat, hi, slot) => (valid) => { const v = valid.find(x => x.type === 'equip' && x.owner === seat && x.heroIdx === hi && x.slotIdx === slot); return v ? [v.id] : null; };
  const chp = (c) => (c.counters.currentHp ?? H.DB[c.name].hp);
  R.section('Held mit genau EINEM negativen Status (Soll: 50 Schaden)');
  for (const st of getNegativeStatuses()) {
    const t = await H.fresh({ hand: [[], []], hp: 800 });
    await t.engine.addHeroStatus(1, 0, st, { appliedBy: 0, source: 'test' });
    if (!t.hero(1, 0).statuses[st]) t.heroStatus(1, 0, st);   // falls die Anwendung vom Engine-Schutz geschluckt wurde
    t.targetFn = heroT(1, 0);
    await t.play(0, 'Stranglehold', { hero: 1 });
    const dmg = 800 - t.hp(1, 0);
    R.check(`Held "${st}" -> 50`, dmg === 50, dmg);
  }
  R.section('Kreatur mit genau EINEM Status-Counter (Soll: 50 Schaden)');
  for (const st of ['frozen', 'stunned', 'burned', 'poisoned', 'negated', 'blinded_hit', 'bleeding', 'bound', 'nulled', 'magic_silenced', 'webbed']) {
    const t = await H.fresh({ hand: [[], []] });
    const c = t.put(1, 0, 0, H.INERT.big);
    c.counters[st] = 1;
    t.targetFn = creatT(1, 0, 0);
    const vorher = chp(c);
    await t.play(0, 'Stranglehold', { hero: 1 });
    R.check(`Kreatur "${st}" -> 50`, vorher - chp(c) === 50, vorher - chp(c));
  }
  R.finish();
})();
