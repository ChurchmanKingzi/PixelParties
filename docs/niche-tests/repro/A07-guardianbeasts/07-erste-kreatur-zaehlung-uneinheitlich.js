'use strict';
// A07-07 · Welche Platzierungen zählen als „erste Kreatur, die du in deinem Zug beschwörst" (Harpyformer-Gratisaktion)?
//
// Kartentexte:
//   Harpyformer (alle zehn): „If this is the first Creature you summon during your turn, summoning it counts as an
//     additional Action."
//   Vullary: „… summon a level 3 or lower Creature … as an additional Action …"   (Text sagt „summon")
//   Cardinal Beast Xuanwu: „… place a level 3 or lower Creature from your discard pile …"   (Text sagt „place")
//
// Beobachtet (Zähler `ps._creaturesSummonedThisTurn`, den `harpyformerInherentAction` liest):
//   • normale Beschwörung        → zählt (Harpyformer danach nicht mehr gratis)             ✓ erwartet
//   • Vullary (Text: „summon")   → zählt NICHT (`countAsSummon:false`, unsettling-opportunist-vullary.js:146)     ← Harpyformer bleibt gratis
//   • Xuanwu  (Text: „place")    → zählt (cardinal-beast-xuanwu.js:146 erhöht den Zähler)  ← Harpyformer nicht mehr gratis
// Das ist das Gegenteil dessen, was die Textverben nahelegen. Dieses Skript hält die Beobachtung fest und prüft die
// Lesart „Text-Verb entscheidet" (✗ = Beobachtung tritt auf). Frage an Al steht im Bericht (Stufe C).
// ★ W10b (Al, Welle 10, Q47: Alles sollte zählen, inklusive Xuanwu): JEDE Platzierung/Beschwörung zählt als erste Kreatur, die du beschwörst. Repro umgestellt:
//   Xuanwu zählt – Harpyformer danach nicht mehr gratis (siehe W10/b-q47).
const H = require('../../lib/h.js');
const { harpyformerInherentAction } = require('../../../../cards/effects/_harpyformer-shared.js');
const D = H.INERT.creature;

(async () => {
  const R = H.runner();
  const frei = (t) => harpyformerInherentAction(t.gs, 0);

  let t = await H.fresh({ discard: [[D], []], deckSize: 10 });
  let x = t.put(0, 0, 0, 'Cardinal Beast Xuanwu'); x.turnPlayed = 1;
  t.script.push({ match: d => d && d.type === 'cardGallery', answer: () => ({ cardName: D, source: 'discard' }) });
  t.script.push({ match: d => d && d.type === 'zonePick', answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, owner: d.zones[0].owner }) });
  t.gs.activePlayer = 0; t.phase(2);
  await t.activateCreature(0, 0, 0);
  R.check('Xuanwu legt eine Kreatur („place"): zählt als Beschwörung, Harpyformer ist danach NICHT mehr gratis', !frei(t), { zaehler: t.gs.players[0]._creaturesSummonedThisTurn });

  t = await H.fresh({ hand: [['Cute Princess Mary', D], []], deckSize: 10 });
  const v = t.put(0, 0, 0, 'Unsettling Opportunist Vullary'); v.turnPlayed = 1;
  t.gs.activePlayer = 0; t.phase(2);
  await t.activateCreature(0, 0, 0);
  t.script.push({ match: d => d && d.type === 'cardGallery', answer: () => ({ cardName: D }) });
  t.phase(2);
  await t.activateCreature(0, 0, 0);
  R.check('Vullary beschwört („summon") eine Kreatur: Harpyformer ist danach NICHT mehr die erste Beschwörung', !frei(t), { zaehler: t.gs.players[0]._creaturesSummonedThisTurn });
  R.finish();
})();
