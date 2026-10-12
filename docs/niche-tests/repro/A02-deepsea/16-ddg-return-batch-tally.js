'use strict';
// A02-deepsea-16 · Dark Deepsea God: das Zurückgeben von 3 Kreaturen zählt für Siphem/Teppes dreimal statt einmal
//
// Kartentexte: Siphem: „Whenever you return **1 or more cards** from your side of the board to your hand, place **1** Deepsea Counter on this Hero."
//              Teppes: „Up to 5 times per turn, when **1 or more cards** are added from your Heroes' Support Zones to your hand, draw **1** card."
//              DDG: „… by returning 2 or more Creatures … from your side of the board to your hand and placing it into one of their Support Zones."
// Konvention (Shu'Chaku, `_deepsea-shared.js` `fireReturnBatchHook`): eine Rückgabe MEHRERER Karten in einem Effekt ist EIN Ereignis → 1 Counter / 1 Zug.
// Erwartung: DDG gibt 3 Kreaturen in einem Zug zurück → Siphem +1 Counter, Teppes zieht 1 Karte.
// Beobachtet: `returnSupportCreatureToHand` feuert `onCardsReturnedToHand` je Kreatur → Siphem +3, Teppes zieht 3 (Hand + 3).
// Ursache: `dark-deepsea-god.js` Step 3 ruft `returnSupportCreatureToHand` in einer Schleife (statt einmal gebündelt wie `fireReturnBatchHook`).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const SIPH = 'Siphem, the Deepsea Demon', TEP = 'Teppes, the Deepsea Vampire';
  const t = await H.fresh({ heroes: [[SIPH, TEP, 'Tushu, the Knowledge Keeper'], []], hand: [['Dark Deepsea God'], []], deck: [Array(10).fill(H.INERT.creature)] });
  const a = t.put(0, 0, 0, 'Deepsea Werewolf'), b = t.put(0, 0, 1, 'Deepsea Siren'), c = t.put(0, 1, 0, 'Deepsea Witch');
  a.turnPlayed = b.turnPlayed = c.turnPlayed = 1;
  t.script.push({ match: d => d.type === 'zonePick', answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, owner: d.zones[0].owner }) });
  t.targetFn = (valid) => valid.filter(v => v.type === 'equip' && v.owner === 0).map(v => v.id);
  const r = await t.play(0, 'Dark Deepsea God', { hero: 0, slot: 0, noGrant: true });
  R.check('DDG gespielt (3 Opfer)', r === true && !!t.find('Dark Deepsea God', 'support'), r);
  R.check('Siphem erhält genau 1 Counter', t.hero(0, 0).deepseaCounters === 1, t.hero(0, 0).deepseaCounters);
  const gezogen = t.pile(0, 'hand').filter(n => n === H.INERT.creature).length;
  R.check('Teppes zieht genau 1 Karte', gezogen === 1, { hand: t.pile(0, 'hand') });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
