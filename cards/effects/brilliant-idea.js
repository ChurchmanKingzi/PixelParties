// ═══════════════════════════════════════════
//  CARD EFFECT: "Brilliant Idea"
//  Spell (Support Magic Lv1, Normal)
//  Search your deck for any card, reveal it
//  and add it to your hand.
//  Same effect as Magnetic Potion/Glove but
//  as a Support Spell with thought bubble anim.
// ═══════════════════════════════════════════

module.exports = {
  blockedByHandLock: true,
  spellPlayCondition(gs, pi) {
    const ps = gs.players[pi];
    return (ps?.mainDeck || []).length > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      if (!ps) return;

      // Confirm
      const choice = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: 'Brilliant Idea',
        message: 'Search your deck for any card and add it to your hand. The card is revealed to your opponent.',
        confirmLabel: '💡 Eureka!',
        confirmClass: 'btn-success',
        cancellable: true,
      });

      if (!choice || choice.cancelled) {
        gs._spellCancelled = true;
        return;
      }

      // Play thought bubble animation on caster
      engine._broadcastEvent('play_zone_animation', {
        type: 'thought_bubbles', owner: pi, heroIdx, zoneSlot: -1,
      });
      await engine._delay(500);

      // Build deduplicated gallery from deck
      const countMap = {};
      for (const cardName of (ps.mainDeck || [])) {
        countMap[cardName] = (countMap[cardName] || 0) + 1;
      }

      const galleryCards = Object.entries(countMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, count]) => ({ name, source: 'deck', count }));

      if (galleryCards.length === 0) return;

      // Show gallery prompt
      const result = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        cards: galleryCards,
        title: 'Brilliant Idea',
        description: 'Pick the perfect card — inspiration strikes!',
        cancellable: false,
      });

      if (!result || !result.cardName) return;

      // Verify the card is actually in the deck
      if (ps.mainDeck.indexOf(result.cardName) < 0) return;

      // Route through the canonical helper so ON_CARD_ADDED_TO_HAND
      // fires (Cosmic Depths Analyzer / Gatherer key off this hook for
      // any opponent search). Helper handles splice + push + tracking
      // + deck-search animation + log + hook + opp reveal.
      await engine.actionAddCardFromDeckToHand(pi, result.cardName, {
        source: 'Brilliant Idea',
        reveal: true,
      });
    },
  },
};
