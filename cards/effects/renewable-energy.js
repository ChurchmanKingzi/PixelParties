// ═══════════════════════════════════════════
//  CARD EFFECT: "Renewable Energy"
//  Artifact (Normal, Cost 0) — Choose up to 3
//  cards with different names from your discard
//  pile and shuffle them back into your deck.
//  Delete this card.
//
//  Uses the shared recycleCardsFromDiscard
//  helper so the discard→deck flight, pile
//  mutation, shuffle, and log all match the
//  other recycler cards (Deepsea Stein, etc.).
//
//  deleteOnUse: the artifact play flow sends
//  this card to deletedPile instead of discardPile.
// ═══════════════════════════════════════════

module.exports = {
  deleteOnUse: true,

  canActivate(gs, pi) {
    const ps = gs.players[pi];
    return (ps?.discardPile || []).length > 0;
  },

  resolve: async (engine, pi) => {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps || (ps.discardPile || []).length === 0) return { cancelled: true };

    // Build gallery from discard pile — unique names only (1 entry per card name)
    const seen = new Set();
    const gallery = [];
    for (const name of (ps.discardPile || [])) {
      if (seen.has(name)) continue;
      seen.add(name);
      gallery.push({ name, source: 'discard' });
    }
    if (gallery.length === 0) return { cancelled: true };

    // Prompt: select up to 3 different cards
    const result = await engine.promptGeneric(pi, {
      type: 'cardGalleryMulti',
      cards: gallery,
      selectCount: Math.min(3, gallery.length),
      minSelect: 1,
      title: 'Renewable Energy',
      description: 'Choose up to 3 cards with different names to shuffle back into your deck.',
      confirmLabel: '🔄 Shuffle Back!',
      confirmClass: 'btn-success',
      cancellable: true,
    });

    if (!result || result.cancelled || !result.selectedCards || result.selectedCards.length === 0) {
      return { cancelled: true };
    }

    const selectedNames = result.selectedCards;

    const recycled = await engine.actionRecycleCards(pi, selectedNames, {
      source: 'Renewable Energy',
      shuffle: true,
    });

    engine.log('renewable_energy', {
      player: ps.username,
      recycled,
      count: recycled.length,
    });

    engine.sync();
    return true;
  },
};
