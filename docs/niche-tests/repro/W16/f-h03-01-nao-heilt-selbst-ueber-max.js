// W16f · H03-heroes-01 Gegenprobe: Nao selbst (lebend, nicht negiert) überheilt weiter - mit Heal auf einen vollen Helden. Eine Kreatur in ihrer Spalte (Skeleton Healer) nicht.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ heroes: [['Nao, the Barrier Priestess', 'Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'], null], hp: 400, hand: [['Heal'], []] });
  await t.run(() => t.engine.runHooks('onGameStart', {}));
  t.setAbilities(0, 0, [['Support Magic'], [], []]);
  t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 1).id];
  await t.play(0, 'Heal', { hero: 0 });
  R.check('Nao selbst überheilt über das Maximum', t.hp(0, 1) > 400, t.hp(0, 1));
  R.check('Max-HP unverändert', t.hero(0, 1).maxHp === 400, t.hero(0, 1).maxHp);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
