'use strict';
// W24a · N1-05 (Held-Zweig): Corpse Explosion reagiert, wenn ein HELD per Attack/Spell ohne Schaden besiegt wird (Insta-Kill), nicht aber bei Opfer / Kreatureneffekt.
// Exit 0 = korrekt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const lauf = async (quelle, opts, soll, label) => {
    const t = await H.fresh({ hand: [[], ['Corpse Explosion']] });
    t.grantFor(1, 1, 'Corpse Explosion');
    await t.run(() => t.engine.actionDefeatHero({ name: quelle, owner: 0, heroIdx: 0, controller: 0, counters: {} }, t.hero(1, 0), opts));
    const angeboten = t.prompts.some(p => p.pi === 1 && p.d.title === 'Corpse Explosion');
    R.check(`${label}: Held 1:0 besiegt`, t.hp(1, 0) <= 0, t.hp(1, 0));
    R.check(`${label}: Corpse Explosion ${soll ? 'wird angeboten' : 'wird NICHT angeboten'}`, angeboten === soll, t.prompts.map(p => p.pi + ':' + p.d.title));
    R.check(`${label}: Sitz 0 ${soll ? 'verliert 50 je Held' : 'bleibt unversehrt'}`, [0, 1, 2].every(h => t.hp(0, h) === (soll ? 750 : 800)), [0, 1, 2].map(h => t.hp(0, h)));
    R.check(`${label}: Sitz 1 (übrige Helden) unversehrt`, t.hp(1, 1) === 800 && t.hp(1, 2) === 800, [t.hp(1, 1), t.hp(1, 2)]);
    R.check(`${label}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  };
  await lauf('Hand of Death', {}, true, 'Spell-Insta-Kill (Hand of Death)');
  await lauf('Burning Skeleton', {}, false, 'Kreatureneffekt-Kill');
  await lauf('Hand of Death', { isSacrifice: true }, false, 'freiwilliges Opfer');
  // Kreatur: Opfer durch einen Spell ist kein "Besiegen"; Zerstörung durch einen Spell schon
  for (const [opfer, soll] of [[true, false], [false, true]]) {
    const t = await H.fresh({ hand: [[], ['Corpse Explosion']] });
    t.grantFor(1, 1, 'Corpse Explosion');
    const k = t.put(1, 1, 0, H.INERT.frail);
    const src = { name: 'Pawn Sacrifice', owner: 1, heroIdx: 1, controller: 1, counters: {} };
    if (opfer) await t.run(() => t.engine.runHooks('onCreatureSacrificed', { creature: k, cardName: k.name, owner: 1, heroIdx: 0, zoneSlot: 0, source: src, _skipReactionCheck: true }));
    await t.run(() => t.engine.actionDestroyCard(src, k, opfer ? { isSacrifice: true } : {}));
    const angeboten = t.prompts.some(p => p.pi === 1 && p.d.title === 'Corpse Explosion');
    R.check(`Kreatur ${opfer ? 'geopfert' : 'durch Spell zerstört'}: Corpse Explosion ${soll ? 'wird angeboten' : 'wird NICHT angeboten'}`, angeboten === soll, t.prompts.map(p => p.pi + ':' + p.d.title));
    R.check(`Kreatur ${opfer ? 'geopfert' : 'durch Spell zerstört'}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  R.finish();
})();
