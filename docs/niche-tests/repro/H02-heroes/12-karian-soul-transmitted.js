// H02-heroes-12 · Grand Inquisitor Karian – „Soul Transmitted" (negativer Status) wirkt trotz „Other negative status effects don't affect this Hero" (Stufe C, Regelfrage)
//
// Kartentext Karian: „… Other negative status effects don't affect this Hero."
// Kartentext Soul Transmigration Ritual: „… The next time the revived Hero is defeated, delete it and all cards in its Ability and Support Zones, except Creatures."
//   (Engine-Status `soul_transmitted`, `negative: true`, direkt gesetzt – ohne `immuneKey`, `_hooks.js:398`)
// Beobachtung: Karian wird mit dem Ritual wiederbelebt (Status haftet), beim nächsten Besiegen wird sie samt Fähigkeit gelöscht – identisch zu jedem anderen Helden.
// Frage an Al: Soll Karians Immunität auch gegen Soul Transmitted gelten (sie wird dann beim zweiten Tod nicht gelöscht) – ja oder nein?
// ★ Welle 13 (Q115, Al: „Nein, DAGEGEN ist Karian nicht immun."): UMGESTELLT auf die neue Regel – Soul Transmitted wirkt auf Karian wie auf jeden anderen Helden, sie wird beim zweiten Besiegen
//   GELÖSCHT (Ist-Zustand). Vorher erwartete dieses Repro die Gegenlesart (Karian bleibt unversehrt).
// Aufruf: node docs/niche-tests/repro/H02-heroes/12-karian-soul-transmitted.js   (Exit 0 = korrekt: Karian wird gelöscht)
const H = require('../../lib/h.js');
const KA = 'Grand Inquisitor Karian';
(async () => {
  const R = H.runner();
  const t = await H.fresh({ heroes: [[KA, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [['Soul Transmigration Ritual'], []] });
  await t.run(() => t.engine.runHooks('onGameStart', {}));
  t.setAbilities(0, 0, [['Fighting'], [], []]);
  t.put(0, 1, 0, H.INERT.creature); t.put(0, 1, 1, H.INERT.creature); t.put(0, 1, 2, H.INERT.creature);
  await t.run(() => t.engine.actionDefeatHero({ name: 'test', owner: 1 }, t.hero(0, 0), { reason: 'test' }));
  t.targetFn = (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === 0 && x.heroIdx === 0); return v ? [v.id] : valid.filter(x => x.type === 'equip' && x.owner === 0).slice(0, 3).map(x => x.id); };
  const r = await t.play(0, 'Soul Transmigration Ritual', { hero: 1, noGrant: true });
  R.check('Ritual gespielt, Karian lebt (800 HP)', r === true && t.hp(0, 0) === 800, { r, hp: t.hp(0, 0) });
  R.note('Status an Karian', Object.keys(t.hero(0, 0).statuses).filter(k => !/immune/.test(k)));
  await t.run(() => t.engine.actionDefeatHero({ name: 'test', owner: 1 }, t.hero(0, 0), { reason: 'test' }));
  R.check('Karian wird beim zweiten Besiegen GELÖSCHT (Soul Transmitted wirkt trotz ihrer Immunität, Q115)', t.hero(0, 0).name !== KA, { name: t.hero(0, 0).name, deleted: t.pile(0, 'deletedPile') });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
