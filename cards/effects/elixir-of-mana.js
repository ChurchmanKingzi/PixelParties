// ═══════════════════════════════════════════
//  CARD EFFECT: "Elixir of Mana"
//  Potion — Choose up to 3 Spells with different
//  names from your discard pile and add them to
//  your hand.
//
//  Hand-size limit is intentionally NOT checked —
//  per game rules, the size cap only forces a
//  discard at certain checkpoints; it never
//  prevents cards from entering hand.
// ═══════════════════════════════════════════

const MAX_PICKS = 3;

function uniqueSpellsInDiscard(gs, pi, engine) {
  const ps = gs.players[pi];
  if (!ps) return [];
  const cardDB = engine?._getCardDB ? engine._getCardDB() : {};
  const seen = new Set();
  const result = [];
  for (const name of (ps.discardPile || [])) {
    if (seen.has(name)) continue;
    const cd = cardDB[name];
    if (!cd || cd.cardType !== 'Spell') continue;
    seen.add(name);
    result.push(name);
  }
  return result;
}

module.exports = {
  isPotion: true,

  canActivate(gs, pi, engine) {
    return uniqueSpellsInDiscard(gs, pi, engine).length > 0;
  },

  async resolve(engine, pi) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return;

    const choices = uniqueSpellsInDiscard(gs, pi, engine);
    if (choices.length === 0) return;

    const galleryCards = choices
      .sort((a, b) => a.localeCompare(b))
      .map(name => ({ name, source: 'discard' }));

    const maxPicks = Math.min(MAX_PICKS, galleryCards.length);
    const result = await engine.promptGeneric(pi, {
      type: 'cardGalleryMulti',
      cards: galleryCards,
      selectCount: maxPicks,
      minSelect: 1,
      title: 'Elixir of Mana',
      description: `Choose up to ${maxPicks} Spell${maxPicks > 1 ? 's' : ''} with different names from your discard pile.`,
      confirmLabel: '✨ Recall',
      confirmClass: 'btn-success',
      cancellable: false,
    });

    if (!result || !Array.isArray(result.selectedCards) || result.selectedCards.length === 0) return;

    // Move each chosen Spell from own discard to own hand and reveal it
    // to the opponent — matching the standard deck-tutor flow. The
    // sequence per card is:
    //   1. addCardFromDiscardToHand → splices the discard, pushes hand,
    //      fires ON_CARD_ADDED_FROM_DISCARD_TO_HAND (Bamboo Staff /
    //      Bamboo Shield listeners react to the recovery).
    //   2. revealSearchedCards → broadcasts the deck_search_add anim,
    //      syncs, waits 500ms, then opens a deckSearchReveal prompt on
    //      the opponent that they must dismiss before the next card.
    // Interleaving produces the same one-by-one feel as deck searches.
    for (const cardName of result.selectedCards) {
      await engine.addCardFromDiscardToHand(pi, cardName, pi, { source: 'Elixir of Mana' });
      await engine.revealSearchedCards(pi, [cardName], 'Elixir of Mana');
    }

    engine.log('elixir_of_mana', {
      player: ps.username,
      recovered: result.selectedCards,
    });
    engine.sync();
  },
};
