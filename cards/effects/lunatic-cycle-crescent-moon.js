// ═══════════════════════════════════════════
//  CARD EFFECT: "Lunatic Cycle - Crescent Moon"
//  Artifact (Equipment, Cost 12, Lunatic)
//
//  Play condition: ≥1 "Lunatic Cycle - New Moon"
//  on the board (either side).
//  Equip to a Hero you control. Any time the
//  equipped Hero performs an Action, you may
//  shuffle any number of cards from your hand
//  back into your deck and draw the same number.
//
//  Reacts on `onAnyActionResolved` (the broad
//  signal — fires for inherent / additional /
//  free plays too, unlike `onActionUsed`),
//  filtered to the equip's controller AND the
//  exact equipped Hero. Optional (cancellable),
//  free, every action.
// ═══════════════════════════════════════════

const { lunaticCycleCountByName } = require('./_lunatic-shared');

const CARD_NAME = 'Lunatic Cycle - Crescent Moon';
const PREREQ = 'Lunatic Cycle - New Moon';

module.exports = {
  // Mischt aus HAND bzw. ABLAGE ins eigene Deck zurueck. Von
  // Distracting Crystal gesperrt und von Hatusbal, the Leader of
  // Tusca mitgelesen. Als Ruling 16.8.: der Krystall deckt NUR
  // Hand und Ablage ab — Brett/Loeschstapel ausdruecklich nicht.
  shufflesFromHandOrDiscardIntoDeck: true,   // Herkunft: Hand

  isEquip: true,
  activeIn: ['support'],

  canEquipToHero(gs, playerIdx, heroIdx, engine) {
    return lunaticCycleCountByName(engine, PREREQ) >= 1;
  },

  hooks: {
    onAnyActionResolved: async (ctx) => {
      const inst = ctx.card;
      if (!inst || inst.zone !== 'support') return;
      // The equip's controller, and the EXACT equipped Hero, must be
      // the one that performed the Action.
      if (ctx.playerIdx !== ctx.cardOwner) return;
      if (ctx.heroIdx == null || ctx.heroIdx !== inst.heroIdx) return;
      // Reentrancy guard — the shuffle/draw below aren't Actions, but
      // be defensive against any nested action resolution.
      if (inst.counters?._crescentBusy) return;

      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const ps = engine.gs.players[pi];
      if (!ps || (ps.hand || []).length === 0) return;
      if (ps.handLocked) return; // can't draw → effect would be pointless

      inst.counters._crescentBusy = true;
      try {
        // In-hand multi-select — the player clicks the cards in their
        // OWN hand to choose what to shuffle back (the `handPick`
        // prompt; same UX as Leadership), NOT a modal gallery.
        const waehlbar = new Set(engine.shuffleBackEligibleHandCards(pi));
        const eligibleIndices = ps.hand
          .map((_, i) => i)
          .filter(i => waehlbar.has(ps.hand[i]));
        if (eligibleIndices.length === 0) return;
        const result = await engine.promptGeneric(pi, {
          type: 'handPick',
          title: CARD_NAME,
          description: 'You may shuffle any number of cards from your hand back into your deck, then draw the same number.',
          eligibleIndices,
          maxSelect: ps.hand.length,
          minSelect: 1,
          confirmLabel: '🌙 Shuffle & Draw',
          cancellable: true,
        });
        if (!result || result.cancelled
          || !Array.isArray(result.selectedCards) || result.selectedCards.length === 0) return;

        // Splice high→low so indices stay stable (Leadership pattern).
        const sortedByIdx = [...result.selectedCards].sort((a, b) => b.handIndex - a.handIndex);
        const namesToReturn = sortedByIdx.map(s => s.cardName);
        const count = namesToReturn.length;

        // actionMulliganCards handles shuffle-back animation, opponent
        // routing, deck shuffle, and reports how many were potions.
        const { potionCount, totalReturned } = await engine.actionMulliganCards(pi, namesToReturn);
        engine.log('lunatic_crescent_cycle', { player: ps.username, count, returned: totalReturned });
        engine.sync();
        await engine._delay(400);

        // Draw the same number back: non-potions from main deck, any
        // potion slots from the potion deck (mirrors Leadership).
        // ★ Als Regel (17.8.): "the same number" meint ALLE
        // zurueckgemischten Karten — auch gestohlene, die ins
        // GEGNER-Deck gingen. `totalReturned` zaehlt beide Decks;
        // die frueher benutzte Auswahlmenge haette bei einem
        // fehlgeschlagenen Rueckweg zu viel gezogen.
        await engine.actionDrawCards(pi, totalReturned - potionCount);
        for (let i = 0; i < potionCount; i++) {
          if ((ps.potionDeck || []).length === 0) break;
          ps.hand.push(ps.potionDeck.shift());
          engine.sync();
          await engine._delay(200);
        }
        engine.sync();
      } finally {
        delete inst.counters._crescentBusy;
      }
    },
  },
};
