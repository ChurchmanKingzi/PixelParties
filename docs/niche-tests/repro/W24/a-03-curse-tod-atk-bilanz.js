'use strict';
// W24a · N1-01 (Randfall): Curse-ATK-Bilanz über den Heldentod – während des Fluchs dazugewonnene ATK (Zwischenspeicher) kommt mit zurück,
// zwei Curse-Kopien am selben Helden geben die ATK nur einmal zurück. Exit 0 = korrekt.
const H = require('../../lib/h.js');
const heroPick = (s, h) => (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === s && x.heroIdx === h); return v ? [v.id] : undefined; };
(async () => {
  const R = H.runner();
  {
    const t = await H.fresh({ hand: [['Curse'], []] });
    t.hero(1, 0).atk = 60; t.targetFn = heroPick(1, 0);
    await t.play(0, 'Curse', { hero: 0 });
    await t.run(() => t.engine.actionGrantAtk({ counters: {} }, t.hero(1, 0), 1, 0, 20));
    const vorTod = t.hero(1, 0)._cursedAtkSuppressed;
    await t.run(() => t.engine.actionDealDamage({ name: 'ZZ', owner: 0, heroIdx: 0, controller: 0, counters: {} }, t.hero(1, 0), 900, 'attack'));
    await t.run(() => t.engine.actionReviveHero(1, 0, 300, { source: 'x' }));
    R.check('Zwischenspeicher vor dem Tod = 60 + 20', vorTod === 80, vorTod);
    R.check('nach Tod + Wiederbelebung: ATK = 80, Zwischenspeicher leer', t.hero(1, 0).atk === 80 && t.hero(1, 0)._cursedAtkSuppressed === undefined, { atk: t.hero(1, 0).atk, sp: t.hero(1, 0)._cursedAtkSuppressed });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
    R.check('Zustand sauber', t.audit().length === 0, t.audit());
  }
  {
    // zweite Kopie am selben Helden
    const t = await H.fresh({ hand: [['Curse', 'Curse'], []] });
    t.hero(1, 0).atk = 60; t.targetFn = heroPick(1, 0);
    await t.play(0, 'Curse', { hero: 0 });
    await t.play(0, 'Curse', { hero: 0 });
    await t.run(() => t.engine.actionDealDamage({ name: 'ZZ', owner: 0, heroIdx: 0, controller: 0, counters: {} }, t.hero(1, 0), 900, 'attack'));
    await t.run(() => t.engine.actionReviveHero(1, 0, 300, { source: 'x' }));
    R.check('zwei Curse-Kopien: nach Tod + Wiederbelebung ATK = 60 (nicht 120, nicht 0)', t.hero(1, 0).atk === 60, t.hero(1, 0).atk);
    R.check('zwei Curse-Kopien: keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
