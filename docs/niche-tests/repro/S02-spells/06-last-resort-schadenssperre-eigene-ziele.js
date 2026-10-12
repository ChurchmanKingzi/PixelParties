'use strict';
// S02-06 · Last Resort: „You cannot deal any other damage the turn you activate this card" – gilt die Sperre auch für EIGENE Ziele? (Regelfrage)
// Kartentext: „… The user is defeated afterwards. If all Heroes of both players are defeated after this Spell resolved, you win the game.
//   You cannot deal any other damage the turn you activate this card."
// Skript: setzt `ps.damageLocked` (wie Flame Avalanche: „… to targets your opponent controls"), die Engine sperrt damit NUR Schaden an
//   Gegnerzielen. Der Text von Last Resort sagt aber „any other damage" (ohne „to targets your opponent controls"); außerdem ist die Karte
//   spielbar, wenn man in diesem Zug zuvor nur eigenen Schaden verursacht hat (`dealtDamageToOpponent` statt `dealtDamageAnyTarget`).
// Beobachtet: nach Last Resort geht Schaden an eigener Kreatur (−100) und eigenem Held (−100) durch; Gegnerziele sind gesperrt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const src = { name: 'Probe', owner: 0, heroIdx: 0, controller: 0 };
  {
    const t = await H.fresh({ hand: [['Last Resort'], []] });
    const own = t.put(0, 1, 0, H.INERT.big); own.counters.currentHp = 1000; own.counters.maxHp = 1000;
    const foe = t.put(1, 1, 0, H.INERT.big); foe.counters.currentHp = 1000; foe.counters.maxHp = 1000;
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    const r = await t.play(0, 'Last Resort', { hero: 0 });
    R.check('Last Resort gespielt, Ziel und Nutzer besiegt', r === true && t.hp(1, 0) <= 0 && t.hp(0, 0) <= 0, [r, t.hp(1, 0), t.hp(0, 0)]);
    const h1 = t.hp(0, 1);
    await t.engine.actionDealCreatureDamage(src, foe, 100, 'destruction_spell', { sourceOwner: 0 });
    await t.engine.actionDealCreatureDamage(src, own, 100, 'destruction_spell', { sourceOwner: 0 });
    await t.engine.actionDealDamage(src, t.hero(0, 1), 100, 'destruction_spell');
    R.check('Kontrolle: Schaden an Gegnerkreatur gesperrt', foe.counters.currentHp === 1000, foe.counters.currentHp);
    R.check('Schaden an EIGENER Kreatur gesperrt („any other damage")', own.counters.currentHp === 1000, own.counters.currentHp);
    R.check('Schaden an EIGENEM Helden gesperrt („any other damage")', t.hp(0, 1) === h1, [h1, t.hp(0, 1)]);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {
    const t = await H.fresh({ hand: [['Last Resort'], []] });
    await t.engine.actionDealDamage(src, t.hero(0, 2), 50, 'destruction_spell');   // nur eigener Schaden vor dem Zauber
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    const r = await t.play(0, 'Last Resort', { hero: 0 });
    R.check('Last Resort bleibt nach (nur) eigenem Vorab-Schaden unspielbar („cannot deal any OTHER damage")', r === false, r);
  }
  R.finish();
})();
