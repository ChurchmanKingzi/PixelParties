// W16f · H03-heroes-10 Gegenprobe: ein umgeleiteter Effekt MIT Schaden (Fireball) bleibt True Damage (Stempel hält bis zur Auflösung).
const H = require('../../lib/h.js');
const MONIA = 'Monia Bot, the Foretold Rescuer of Coolness';
const FILL = ['Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'];
(async () => {
  const R = H.runner();
  const t = await H.fresh({ heroes: [[MONIA, ...FILL], null], hp: 800, active: 1, hand: [[], ['Fireball']] });
  await t.run(() => t.engine.runHooks('onGameStart', {}));
  t.script.push({ match: d => d.type === 'confirm' && /Monia/.test(d.title || ''), answer: () => ({ confirmed: true }) });
  t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 0 && x.heroIdx === 1).id];
  const r = await t.play(1, 'Fireball', { hero: 0 });
  R.check('Fireball behandelt', r === true, r);
  R.check('Monia nahm den umgeleiteten Schaden (Tushu unberührt)', t.hp(0, 1) === 800 && t.hp(0, 0) < 800, [t.hp(0, 0), t.hp(0, 1)]);
  R.check('Der umgeleitete Schaden war True Damage', t.lg('true_damage').length === 1, t.lg('true_damage'));
  R.check('Stempel danach weg', !t.gs._redirectedTrueDamage, t.gs._redirectedTrueDamage);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
