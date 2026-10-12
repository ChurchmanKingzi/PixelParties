'use strict';
// A05-skeletons-20 · Winged Skeleton antwortet nicht auf jede Wahl seines Skeletts durch Gegnerkarten
// Kartentext (Winged Skeleton): „Once per turn, when a "Skeleton" Creature you control is chosen by an opponent's card or effect, you may return that Creature back to
//   your hand to negate the card or effect."
// Kontrolle: Skeleton Reaper / Skeleton Archer (Einzelschaden) → Angebot erscheint (✓).
// Beobachtet: KEIN Angebot bei (a) Burning Skeleton (Burn), (b) Skeleton Death Knight (Negate/Bound), (c) Dive Bomblebee (Karte unten ins Deck), (d) Sparkfly Worker (Karte auf die Hand).
//   Die Wirkung landet jeweils ungehindert.
// Ursache: `winged-skeleton.js` hört nur auf `beforeCreatureAffected` (feuert aus actionDestroyCard/actionMoveCard/actionApplyCreaturePoison/actionHealCreature)
//   und `beforeCreatureDamageBatch`. Statuswege `applyCreatureStatus`/`actionNegateCreature` sowie die rohen Zonenwege von Dive Bomblebee und
//   `_sparkfly-shared.stealBoardCardToHand` rufen den Haken nicht.
const H = require('../../lib/h.js');
const wing = (t) => t.prompts.filter(p => p.d.type === 'confirm' && p.d.title === 'Winged Skeleton').length;
(async () => {
  const R = H.runner();
  // Kontrolle + (a) + (b): aktive Kreatureneffekte des Gegners
  for (const [name, soll] of [['Skeleton Reaper', true], ['Burning Skeleton', true], ['Skeleton Death Knight', true]]) {
    const t = await H.fresh({});
    const w = t.put(0, 0, 0, 'Winged Skeleton'); w.turnPlayed = 1;
    const arch = t.put(0, 0, 1, 'Skeleton Archer'); arch.turnPlayed = 1;
    const tater = t.put(1, 0, 0, name); tater.turnPlayed = 1;
    t.targetFn = (valid) => { const v = valid.find(x => x.cardName === 'Skeleton Archer' && x.owner === 0); return [v ? v.id : valid[0].id]; };
    t.gs.activePlayer = 1; t.phase(2);
    await t.activateCreature(1, 0, 0);
    R.check(name + ' wählt das Skelett → Winged Skeleton bekommt das Angebot', wing(t) >= 1, { angebote: wing(t) });
  }
  // (c) Dive Bomblebee
  { const t = await H.fresh({});
    const w = t.put(0, 0, 0, 'Winged Skeleton'); w.turnPlayed = 1;
    t.put(0, 0, 1, 'Skeleton Archer').turnPlayed = 1;
    t.put(1, 0, 0, 'Dive Bomblebee').turnPlayed = 1;
    const opfer = t.put(0, 2, 2, H.INERT.frail);
    t.targetFn = (valid) => { const v = valid.find(x => x.cardName === 'Skeleton Archer'); return [v ? v.id : valid[0].id]; };
    await t.run(() => t.engine.actionDestroyCard({ name: 'x', owner: 1 }, opfer));
    R.check('Dive Bomblebee wählt das Skelett → Winged Skeleton bekommt das Angebot', wing(t) >= 1, { angebote: wing(t), deckUnten: t.pile(0, 'mainDeck').slice(-1) });
  }
  // (d) Sparkfly Worker
  { const t = await H.fresh({ hand: [[], ['Sparkfly Worker']] });
    t.put(0, 0, 0, 'Winged Skeleton').turnPlayed = 1;
    t.put(0, 0, 1, 'Skeleton Archer').turnPlayed = 1;
    t.put(1, 0, 2, 'Sparkfly Queen').turnPlayed = 1;
    t.setAbilities(1, 0, [['Summoning Magic'], [], []]);
    t.targetFn = (valid) => { const v = valid.find(x => x.cardName === 'Skeleton Archer'); return [v ? v.id : valid[0].id]; };
    await t.play(1, 'Sparkfly Worker', { hero: 0, slot: 0 });
    R.check('Sparkfly Worker wählt das Skelett → Winged Skeleton bekommt das Angebot', wing(t) >= 1, { angebote: wing(t), handGegner: t.pile(1, 'hand') });
  }
  R.finish();
})();
