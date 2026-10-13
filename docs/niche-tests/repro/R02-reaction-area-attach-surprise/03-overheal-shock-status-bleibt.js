'use strict';
// R02-03 · Overheal Shock: `healReversed` bleibt am Helden, nachdem die Karte das Brett verlassen hat
// Kartentext: „Attach this card to a Hero your opponent controls. Any healing that Hero would receive is applied as damage instead."
// Skriptkopf (overheal-shock.js): „Sets hero.statuses.healReversed for visuals. Cleared when the card leaves the zone." / `onCardLeaveZone`: löscht den Status, wenn kein anderes Overheal Shock mehr in den Support Zones des Helden liegt.
// Aufbau: Sitz 0 legt Overheal Shock auf Held 0 von Sitz 1 (800 HP, vorher auf 500 gesetzt). Danach verlässt die Karte das Brett
//   (a) `actionDestroyCard` (Zerstörung durch einen Effekt), (b) `sendBoardCardToDiscard`, (c) `actionMoveCard` zurück auf die Hand.
// Erwartet: Status weg; eine Heilung von 100 hebt die HP (500 → 600).
// Beobachtet: `healReversed` steht weiter am Helden; die Heilung wird weiter als Schaden gebucht (500 → 400), obwohl die Karte nicht mehr am Helden hängt.
// Ursache: Der Austritts-Hook feuert VOR dem Entfernen aus der Zone (siehe Kommentar in spatial-crevice.js „Der Leave-Hook feuert VOR dem Zonenwechsel"). `onCardLeaveZone`
//   (overheal-shock.js Z. 398–418) sucht `supportZones.some(slot => slot.includes('Overheal Shock'))` – findet dabei die gerade gehende Karte selbst – und lässt den Status stehen.
//   Beim Heldentod räumt `handleHeroDeathCleanup` den Status separat weg (dort ✓).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const way of ['actionDestroyCard', 'sendBoardCardToDiscard', 'actionMoveCard(hand)']) {
    const t = await H.fresh({ hand: [['Overheal Shock'], []], hp: 800 });
    t.setAbilities(0, 0, [['Support Magic', 'Support Magic'], [], []]);
    t.hero(1, 0).hp = 500;
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    await t.play(0, 'Overheal Shock', { hero: 0 });
    const inst = t.find('Overheal Shock', 'support');
    R.check(`${way}: Aufbau – Karte liegt am Helden, Status gesetzt`, !!inst && !!t.hero(1, 0).statuses.healReversed);
    if (way === 'actionDestroyCard') await t.engine.actionDestroyCard({ name: 'Test', owner: 0 }, inst);
    else if (way === 'sendBoardCardToDiscard') await t.engine.sendBoardCardToDiscard(inst, { source: 'Test', sourceOwner: 0 });
    else await t.engine.actionMoveCard(inst, 'hand', -1, -1, { source: 'Test', sourceOwner: 0, toPlayer: 0 });
    R.check(`${way}: Karte hat das Brett verlassen`, inst.zone !== 'support', inst.zone);
    R.check(`${way}: healReversed ist weg`, !t.hero(1, 0).statuses.healReversed, t.hero(1, 0).statuses.healReversed);
    await t.engine.actionHealHero({ name: 'Test', owner: 1 }, t.hero(1, 0), 100);
    R.check(`${way}: Heilung 100 hebt die HP (500 → 600)`, t.hp(1, 0) === 600, t.hp(1, 0));
    R.check(`${way}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  R.finish();
})();
