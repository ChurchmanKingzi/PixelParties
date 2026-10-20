'use strict';
// W25a · Nachtrag zur N5-09-Klasse (Al 21.10.2026): `opts.unhealable` (`applyCreatureStatus`, W24e) auch bei Perilous Journey (`burnedUnhealable`) und Venom Infusion (`poisonedUnhealable`, Decay Magic 3):
// die Unheilbar-Marke steht auf der Kreatur, wenn das Reaktionsfenster des Status (Hook `onStatusApplied`) öffnet - eine Reaktion in diesem Fenster darf den Status nicht mehr entfernen.
// Messung: ein Wächter um `runHooks` liest im Moment von `onStatusApplied` die Marke; zusätzlich ein Reiniger-Versuch (`cleanseCreatureStatuses`) im Fenster.
// Aufruf: node docs/niche-tests/repro/W25/a-05-unheilbar-marke-vor-dem-fenster.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const { loadCardEffect } = require('../../../../cards/effects/_loader.js');
const wache = (t, inst, markeKey, statusKey) => {
  const rec = { marke: null, nachReinigung: null };
  const orig = t.engine.runHooks.bind(t.engine);
  t.engine.runHooks = async (name, ctx) => {
    if (name === 'onStatusApplied' && ctx?.target === inst && ctx.statusName === statusKey && rec.marke === null) {
      rec.marke = !!inst.counters[markeKey];
      try { t.engine.cleanseCreatureStatuses?.(inst, [statusKey]); } catch (e) { rec.fehler = e.message; }   // Reaktion im Fenster versucht zu reinigen
      rec.nachReinigung = !!inst.counters[statusKey];
    }
    return orig(name, ctx);
  };
  return rec;
};
(async () => {
  const R = H.runner();
  R.section('Perilous Journey: Dauerbrand auf eigene Kreaturen');
  { const t = await H.fresh({ hand: [[], []] });
    const k = t.put(0, 1, 0, H.INERT.creature);
    const rec = wache(t, k, 'burnedUnhealable', 'burned');
    await t.run(() => loadCardEffect('Perilous Journey').onAscensionGrantUsed(t.engine, 0));
    R.check('Marke burnedUnhealable steht VOR dem Fenster', rec.marke === true, rec);
    R.check('Reinigungsversuch im Fenster entfernt den Brand nicht', rec.nachReinigung === true, rec);
    R.check('Kreatur brennt, Marke bleibt', !!k.counters.burned && !!k.counters.burnedUnhealable, k.counters);
    R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() }); }
  R.section('Venom Infusion Lv3 auf eine Kreatur');
  for (const lv3 of [true, false]) {
    const t = await H.fresh({ hand: [['Venom Infusion'], []] });
    t.setAbilities(0, 0, [lv3 ? ['Decay Magic', 'Decay Magic', 'Decay Magic'] : ['Decay Magic'], [], []]);
    const k = t.put(1, 1, 0, H.INERT.creature);
    const rec = wache(t, k, 'poisonedUnhealable', 'poisoned');
    t.targetFn = (v) => { const y = v.find(z => z.type === 'equip' && z.owner === 1); return y ? [y.id] : undefined; };
    await t.play(0, 'Venom Infusion', { hero: 0, noGrant: true });
    if (lv3) {
      R.check('Lv3: Marke poisonedUnhealable steht VOR dem Fenster', rec.marke === true, rec);
      R.check('Lv3: Reinigungsversuch im Fenster entfernt das Gift nicht', rec.nachReinigung === true, rec);
      R.check('Lv3: Kreatur vergiftet, Marke bleibt', !!k.counters.poisoned && !!k.counters.poisonedUnhealable, k.counters);
    } else {
      R.check('Gegenprobe Lv1: keine Marke, Reinigung im Fenster hilft', rec.marke === false && rec.nachReinigung === false && !k.counters.poisonedUnhealable, { rec, c: k.counters });
    }
    R.check(`sauber (Lv3=${lv3})`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  R.finish();
})();
