// H02-heroes-07 · Ida, the Adept of Destruction – Durchschlag gegen „unaffected by all cards and effects" (Cardinal Beast Baihu) – Stufe C (Regelfrage)
//
// Kartentext Ida: „The damage this Hero's Destruction Spells deal to your opponent's targets cannot be reduced or negated and ignore any effects that make a target unaffected by them."
// Kartentext Cardinal Beast Baihu: „This Creature is unaffected by all cards and effects."
// Frage: Soll Idas Zauberschaden Baihu trotz absoluter Immunität treffen? Beobachtung: nein (Schaden 0, mit und ohne Ida gleich).
// Aufruf: node docs/niche-tests/repro/H02-heroes/07-ida-cardinal-beast-unaffected.js   (✗ = Idas Durchschlag greift nicht)
const H = require('../../lib/h.js');
const IDA = 'Ida, the Adept of Destruction';
(async () => {
  const R = H.runner();
  const t = await H.fresh({ heroes: [[IDA, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [['Rockfall'], []] });
  await t.run(() => t.engine.runHooks('onGameStart', {}));
  const baihu = t.put(1, 0, 0, 'Cardinal Beast Baihu');
  t.targetFn = (valid) => { const v = valid.find(x => x.type === 'equip' && x.owner === 1); return v ? [v.id] : null; };
  const hp0 = baihu.counters.currentHp ?? H.DB['Cardinal Beast Baihu'].hp;
  const r = await t.play(0, 'Rockfall', { hero: 0 });
  const hp1 = baihu.counters.currentHp ?? H.DB['Cardinal Beast Baihu'].hp;
  R.check('Rockfall gespielt', r === true, r);
  R.check('Baihu nimmt 200 Schaden (Ida ignoriert „unaffected")', hp0 - hp1 === 200, { hp0, hp1 });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
