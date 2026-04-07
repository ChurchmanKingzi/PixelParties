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
    if (ps?.handLocked) return false;
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
      if (ps.handLocked) { gs._spellCancelled = true; return; }

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
      const deckIdx = ps.mainDeck.indexOf(result.cardName);
      if (deckIdx < 0) return;

      // Remove from deck, add to hand
      ps.mainDeck.splice(deckIdx, 1);
      ps.hand.push(result.cardName);

      // Broadcast deck search event
      engine._broadcastEvent('deck_search_add', { cardName: result.cardName, playerIdx: pi });
      engine.log('deck_search', { player: ps.username, card: result.cardName, by: 'Brilliant Idea' });
      engine.sync();

      // Show reveal prompt to opponent
      await engine._delay(500);
      const oi = pi === 0 ? 1 : 0;
      await engine.promptGeneric(oi, {
        type: 'deckSearchReveal',
        cardName: result.cardName,
        searcherName: ps.username,
        title: 'Brilliant Idea',
        cancellable: false,
      });
    },
  },
};
