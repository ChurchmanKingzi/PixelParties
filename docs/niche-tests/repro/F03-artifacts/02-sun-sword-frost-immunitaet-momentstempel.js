'use strict';
// F03-artifacts-02 · The Sun Sword: Frost-Immunität ist ein Momentstempel, kein Dauerprädikat
// Kartentext: „… targets you control cannot be Frozen …" (solange das Schwert liegt).
// Das Skript stempelt `freeze_immune` nur (a) beim Anlegen auf die dann LEBENDEN, kontrollierten Helden/Kreaturen und (b) auf neu eintretende Kreaturen
//   (`onCardEnterZone`). Alles, was sich DANACH ändert, wird nicht nachgezogen.
// Erwartung: Schwert liegt → jedes Ziel, das Sitz 0 gerade kontrolliert, ist nicht einfrierbar; was Sitz 0 nicht (mehr) kontrolliert, ist es auch nicht.
// Beobachtet (✗): 
//   E) von Sitz 0 gestohlene Gegner-Kreatur ist einfrierbar;
//   F) von Sitz 1 gestohlene (vorher immune) Kreatur bleibt immun – Gegner bekommt Gratis-Immunität;
//   G) wiederbelebter Held (ob vorher tot oder beim Anlegen tot) ist einfrierbar (Status werden beim Tod geleert, nie neu gestempelt);
//   H) dauerhaft übernommener Gegner-Held (actionTakeHeroPermanently) ist einfrierbar.
// Ursache: `cards/effects/the-sun-sword.js` applyFreezeImmunity() nur in onPlay/onGameStart; kein Hook für onRevive / onTakeControl / Kontrollwechsel.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const SS = 'The Sun Sword';
  const cr = (t, s, hi, sl) => t.put(s, hi, sl, H.INERT.big, { counters: { currentHp: 1000, maxHp: 1000 } });
  // E
  let t = await H.fresh({ hand: [[SS], []] });
  const foe = cr(t, 1, 0, 0);
  await t.play(0, SS, { hero: 0, slot: 0 });
  await t.run(() => t.engine.actionStealCreature(0, foe));
  await t.run(() => t.engine.applyCreatureStatus(foe, 'frozen', { sourceOwner: 1 }));
  R.check('E) gestohlene Kreatur (Kontrolleur Sitz 0) nicht einfrierbar', !foe.counters.frozen, foe.counters);
  // F
  t = await H.fresh({ hand: [[SS], []] });
  const mine = cr(t, 0, 1, 0);
  await t.play(0, SS, { hero: 0, slot: 0 });
  await t.run(() => t.engine.actionStealCreature(1, mine));
  await t.run(() => t.engine.applyCreatureStatus(mine, 'frozen', { sourceOwner: 0 }));
  R.check('F) von Sitz 1 gestohlene Kreatur ist einfrierbar (Sitz 0 kontrolliert sie nicht mehr)', !!mine.counters.frozen, mine.counters);
  // G
  t = await H.fresh({ hand: [[SS], []] });
  await t.play(0, SS, { hero: 0, slot: 0 });
  await t.run(() => t.engine.actionDealDamage({ name: 'Test', owner: 1, heroIdx: 0 }, t.hero(0, 1), 5000, 'creature'));
  await t.run(() => t.engine.actionReviveHero(0, 1, 300));
  await t.run(() => t.engine.addHeroStatus(0, 1, 'frozen', { duration: 1, appliedBy: 1 }));
  R.check('G) wiederbelebter Held nicht einfrierbar (Schwert liegt weiter)', !t.hero(0, 1).statuses.frozen, t.hero(0, 1).statuses);
  // H
  t = await H.fresh({ hand: [[SS], []] });
  await t.play(0, SS, { hero: 0, slot: 0 });
  await t.run(() => t.engine.actionTakeHeroPermanently(0, 1, 1));
  await t.run(() => t.engine.addHeroStatus(1, 1, 'frozen', { duration: 1, appliedBy: 1 }));
  R.check('H) dauerhaft übernommener Gegner-Held nicht einfrierbar', !t.hero(1, 1).statuses.frozen, t.hero(1, 1).statuses);
  R.finish();
})();
