// W16f · H02-heroes-09 Nachprobe: Jenny holt Fighting-Karten eines dauerhaft übernommenen Gegnerhelden - Zustand sauber, Kartenbilanz stimmt,
// die zurückgeholten Karten gehören dem Vorbesitzer (Ablage beim Abwerfen: Sitz 1).
const H = require('../../lib/h.js');
const JENNY = 'Jenny, the Class Fairy';
(async () => {
  const R = H.runner();
  const t = await H.fresh({ heroes: [[JENNY, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], abilities: { 1: { 0: [['Fighting', 'Fighting'], [], []] } }, deckSize: 20 });
  await t.run(() => t.engine.actionTakeHeroPermanently(0, 1, 0, { sourceName: 'Paraseed' }));
  t.targetFn = (valid) => valid.filter(v => v.type === 'ability').map(v => v.id);
  t.script.push({ match: d => d.type === 'optionPicker', answer: () => ({ optionId: '2' }), once: true });
  const vor = t.census();
  const hand0 = t.pile(0, 'hand').length;
  const r = await t.activateHero(0, 0, { effect: JENNY });
  R.check('aktiviert', r === true, r);
  R.check('2 Fighting + 2 gezogene Karten auf der Hand', t.pile(0, 'hand').length - hand0 === 4, t.pile(0, 'hand'));
  R.check('Ability Zones des übernommenen Helden leer', (t.gs.players[1].abilityZones[0][0] || []).length === 0, t.gs.players[1].abilityZones[0]);
  const fremd = t.engine.cardInstances.filter(c => c.zone === 'hand' && c.owner === 0 && c.name === 'Fighting');
  R.check('Fighting-Handkarten tragen den Vorbesitzer (Sitz 1)', fremd.length === 2 && fremd.every(c => c.originalOwner === 1), fremd.map(c => c.originalOwner));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.check('Zustand sauber', t.audit().length === 0, t.audit());
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
