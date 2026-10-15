'use strict';
// W13c · Q115 (H02-heroes-12, Karian und „Soul Transmitted") · Al, 15.10.2026: „Nein, DAGEGEN ist Karian nicht immun." → Ist-Zustand, keine Änderung (Absicherung).
//   Soul Transmitted (Lösch-Ersatz von Soul Transmigration Ritual, „The next time the revived Hero is defeated, delete it and all cards in its Ability and Support Zones, except Creatures") wirkt auf
//   Karian trotz „Other negative status effects don't affect this Hero" wie auf jeden anderen Helden.
// Erwartung: Karian wird per Ritual wiederbelebt (800 HP, Status haftet) und beim nächsten Besiegen samt Fähigkeit GELÖSCHT; Kontrolle: ein anderer Held wird genauso gelöscht. Exit 0 = korrekt.
const H = require('../../lib/h.js');
const KA = 'Grand Inquisitor Karian';
(async () => {
  const R = H.runner();
  for (const [name, zusatz] of [[KA, true], ['Rick, the Hero', false]]) {
    const t = await H.fresh({ heroes: [[name === KA ? KA : H.BLANK_HEROES[0], H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [['Soul Transmigration Ritual'], []] });
    if (name === KA) await t.run(() => t.engine.runHooks('onGameStart', {}));
    const held = t.hero(0, 0).name;
    t.setAbilities(0, 0, [['Fighting'], [], []]);
    t.put(0, 1, 0, H.INERT.creature); t.put(0, 1, 1, H.INERT.creature); t.put(0, 1, 2, H.INERT.creature);
    await t.run(() => t.engine.actionDefeatHero({ name: 'test', owner: 1 }, t.hero(0, 0), { reason: 'test' }));
    t.targetFn = (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === 0 && x.heroIdx === 0); return v ? [v.id] : valid.filter(x => x.type === 'equip' && x.owner === 0).slice(0, 3).map(x => x.id); };
    const r = await t.play(0, 'Soul Transmigration Ritual', { hero: 1, noGrant: true });
    R.check(`${held}: Ritual gespielt, Held lebt (800 HP)`, r === true && t.hp(0, 0) === 800, { r, hp: t.hp(0, 0) });
    R.check(`${held}: negativer Status \`soul_transmitted\` haftet`, !!t.hero(0, 0).statuses.soul_transmitted, Object.keys(t.hero(0, 0).statuses));
    await t.run(() => t.engine.actionDefeatHero({ name: 'test', owner: 1 }, t.hero(0, 0), { reason: 'test' }));
    R.check(`${held}: beim zweiten Besiegen GELÖSCHT (Karian nicht immun dagegen)`, t.hero(0, 0).name !== held || !t.hero(0, 0).name, { name: t.hero(0, 0).name, deleted: t.pile(0, 'deletedPile') });
    R.check(`${held}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
    void zusatz;
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
