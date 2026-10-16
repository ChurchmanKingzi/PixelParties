'use strict';
// W14c · Q169 (S02-06) Last Resort: „You cannot deal any other damage to targets your opponent controls the turn you activate this card." (Al 16.10.2026: „Ja, wie Avalanche")
// Erwartet: nach Last Resort sind weitere Schäden an Gegnerzielen 0, an EIGENEN Zielen (Kreatur, Held) laufen sie normal; eigener Vorab-Schaden macht die Karte nicht unspielbar;
//   Schaden an einem Gegnerziel VOR dem Zauber macht sie unspielbar (wie Flame Avalanche); der Kartentext von Last Resort UND Flame Avalanche trägt den neuen Sperrsatz.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const cards = require(H.ROOT + '/data/cards.json');
  const satz = 'You cannot deal any other damage to targets your opponent controls the turn you activate this card.';
  for (const n of ['Last Resort', 'Flame Avalanche']) {
    const c = cards.find(x => x.name === n);
    R.check(`Kartentext ${n} endet mit dem neuen Sperrsatz`, !!c && c.effect.endsWith(satz) && (c.effect.match(/cannot deal any other damage/g) || []).length === 1, c && c.effect);
  }
  const src = { name: 'Probe', owner: 0, heroIdx: 0, controller: 0 };
  {
    const t = await H.fresh({ hand: [['Last Resort'], []] });
    const own = t.put(0, 1, 0, H.INERT.big); own.counters.currentHp = 1000; own.counters.maxHp = 1000;
    const foe = t.put(1, 1, 0, H.INERT.big); foe.counters.currentHp = 1000; foe.counters.maxHp = 1000;
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    const r = await t.play(0, 'Last Resort', { hero: 0 });
    R.check('Last Resort gespielt, Ziel und Nutzer besiegt', r === true && t.hp(1, 0) <= 0 && t.hp(0, 0) <= 0, [r, t.hp(1, 0), t.hp(0, 0)]);
    const h1 = t.hp(0, 1), g1 = t.hp(1, 1);
    await t.engine.actionDealCreatureDamage(src, foe, 100, 'destruction_spell', { sourceOwner: 0 });
    await t.engine.actionDealCreatureDamage(src, own, 100, 'destruction_spell', { sourceOwner: 0 });
    await t.engine.actionDealDamage(src, t.hero(0, 1), 100, 'destruction_spell');
    await t.engine.actionDealDamage(src, t.hero(1, 1), 100, 'destruction_spell');
    R.check('Gegnerkreatur gesperrt', foe.counters.currentHp === 1000, foe.counters.currentHp);
    R.check('Gegnerheld gesperrt', t.hp(1, 1) === g1, [g1, t.hp(1, 1)]);
    R.check('EIGENE Kreatur nimmt normal Schaden', own.counters.currentHp === 900, own.counters.currentHp);
    R.check('EIGENER Held nimmt normal Schaden', t.hp(0, 1) === h1 - 100, [h1, t.hp(0, 1)]);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {
    const t = await H.fresh({ hand: [['Last Resort'], []] });
    await t.engine.actionDealDamage(src, t.hero(0, 2), 50, 'destruction_spell');   // nur eigener Schaden vor dem Zauber
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    const r = await t.play(0, 'Last Resort', { hero: 0 });
    R.check('nach (nur) eigenem Vorab-Schaden ist Last Resort spielbar', r === true, r);
  }
  {
    const t = await H.fresh({ hand: [['Last Resort'], []] });
    await t.engine.actionDealDamage(src, t.hero(1, 2), 50, 'destruction_spell');   // Schaden an einem Gegnerziel vor dem Zauber
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    const r = await t.play(0, 'Last Resort', { hero: 0 });
    R.check('nach Schaden an einem Gegnerziel bleibt Last Resort unspielbar (wie Flame Avalanche)', r === false, r);
  }
  R.finish();
})();
