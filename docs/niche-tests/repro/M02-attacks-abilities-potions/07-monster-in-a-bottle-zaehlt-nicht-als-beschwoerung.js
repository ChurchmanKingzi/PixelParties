'use strict';
// M02-07 · Monster in a Bottle zählt nicht als „Kreatur diesen Zug beschworen"
// Kartentext Monster in a Bottle: „Choose a level 3 or lower Creature from your hand or discard pile and immediately SUMMON it as an additional Action."
// Kartentext Aggressive Town Guard: „If this is the first Creature you summon this turn, summoning this Creature counts as an additional Action."
// Engine-Konvention (z. B. necromancy.js Z. ~333, create-illusion.js, staff-of-illusions.js, _engine.js `summonCreatureWithHooks`): jede auf das Brett gebrachte
//   Kreatur erhöht `ps._creaturesSummonedThisTurn` – dieser Zähler speist die „erste Kreatur diesen Zug"-Tore (Aggressive Town Guard, Pawn/Rook of Kings [W], Harpyformer, Ska …).
// Erwartung: Nach Monster in a Bottle steht der Zähler auf ≥ 1; eine zweite Aggressive Town Guard ist KEINE Gratis-Zusatzaktion mehr, sondern verbraucht die Aktion.
// Beobachtet: `monster-in-a-bottle.js` stellt die Kreatur per `_trackCard` aufs Brett (Z. 252), hebt den Zähler aber nie an. Zähler bleibt 0, die zweite
//   Town Guard bleibt eine Gratis-Zusatzaktion (Phase bleibt 3), und der Bottle-Treffer selbst ist für „first Creature this turn" unsichtbar.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [[], []], hp: 800 });
  t.setHand(0, ['Monster in a Bottle', 'Aggressive Town Guard', 'Aggressive Town Guard']);
  t.grantFor(0, 0, 'Aggressive Town Guard');
  t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Aggressive Town Guard', source: 'hand' }) });
  t.script.push({ match: d => d.type === 'zonePick', answer: () => ({ heroIdx: 0, slotIdx: 0 }) });
  const r1 = await t.play(0, 'Monster in a Bottle', { hero: 0, noGrant: true });
  const ps = t.gs.players[0];
  R.check('Bottle hat die Town Guard auf das Brett gebracht', r1 === true && t.zone(0, 0, 0) === 'Aggressive Town Guard', { r1, zone: t.zone(0, 0, 0) });
  R.check('Zähler „diesen Zug beschworen" ≥ 1', (ps._creaturesSummonedThisTurn || 0) >= 1, ps._creaturesSummonedThisTurn);
  // zweite Town Guard über den echten Weg in der Action Phase
  t.resetActions(0);
  const r2 = await t.play(0, 'Aggressive Town Guard', { hero: 0, slot: 1, phase: 3, keepActions: true });
  R.check('zweite Town Guard gespielt', r2 === true && t.zone(0, 0, 1) === 'Aggressive Town Guard', { r2, zone: t.zone(0, 0, 1) });
  R.check('zweite Town Guard ist KEINE Zusatzaktion (Action Phase ist danach beendet, Phase 4)', t.gs.currentPhase === 4, t.gs.currentPhase);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
