'use strict';
// A06-rebelliokai-26 · Loyal Pinpom: die Zweitbeschwörung nutzt auch gefrorene/betäubte/aktionsgesperrte Helden als Beschwörer
// Kartentext Loyal Pinpom: „When you summon this Creature, you may immediately summon another "Loyal" Creature from your hand as an additional Action."
// Ruling (Kopf von cards/effects/_summon-eligibility.js, Ruling 8.8. + CARD_API „BESCHWÖRUNGSSPERREN"): „summon as an additional Action" ist eine
//   ganz normale Beschwörung → tauglicher Beschwörer Pflicht (nicht Frozen/Stunned/Webbed/Bound/Negated, keine Aktionssperre).
// Beobachtung: loyal-pinpom.js prüft pro Held nur `hp > 0`, freie Zone und `heroMeetsLevelReq`; der zweite Held (Summoning Magic Lv1, aber
//   gefroren/betäubt bzw. mit `_actionLockedTurn`) bekommt den Beagle trotzdem. (Ein negierter Held 1 wird gemessen korrekt abgelehnt.)
// Erwartung: der Beagle bleibt auf der Hand (kein Beschwörer außer Held 0, dessen Zonen voll sind).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const D = H.INERT.creature, SM1 = [['Summoning Magic']];
  const setup = async ({ status = null, actionLock = false } = {}) => {
    const t = await H.fresh({ hand: [['Loyal Pinpom', 'Loyal Beagle'], []] });
    t.setAbilities(0, 0, SM1); t.setAbilities(0, 1, SM1);
    if (status) t.heroStatus(0, 1, status);
    if (actionLock) t.hero(0, 1)._actionLockedTurn = t.gs.turn;
    t.put(0, 0, 1, D); t.put(0, 0, 2, D);                 // Held 0: nur Slot 0 für Pinpom
    for (const z of [0, 1, 2]) t.put(0, 2, z, D);         // Held 2 voll
    return t;
  };
  let t, r;
  for (const st of ['frozen', 'stunned']) {
    t = await setup({ status: st });
    r = await t.play(0, 'Loyal Pinpom', { hero: 0, slot: 0 });
    const h1 = [0, 1, 2].map(z => t.zone(0, 1, z));
    R.check('Pinpom, Held 1 ' + st + ': Beagle landet NICHT bei Held 1', !h1.includes('Loyal Beagle'), { r, h1, hand: t.pile(0, 'hand') });
  }
  t = await setup({ actionLock: true });
  r = await t.play(0, 'Loyal Pinpom', { hero: 0, slot: 0 });
  R.check('Pinpom, Held 1 mit Aktionssperre (_actionLockedTurn): Beagle landet NICHT bei Held 1', ![0, 1, 2].map(z => t.zone(0, 1, z)).includes('Loyal Beagle'), { r, hand: t.pile(0, 'hand') });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
