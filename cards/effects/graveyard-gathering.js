// ═══════════════════════════════════════════
//  CARD EFFECT: "Graveyard Gathering"
//  Spell (Magic Arts Lv1) — Inherent additional
//  Action. Search your deck for an Ascended Hero,
//  reveal it and add it to your hand.
// ═══════════════════════════════════════════

module.exports = {
  inherentAction: true,

  // Gray out when no Ascended Heroes in deck
  spellPlayCondition(gs, pi, engine) {
    if (!engine) return true;
    const ps = gs.players[pi];
    const cardDB = engine._getCardDB();
    return (ps.mainDeck || []).some(cn => cardDB[cn]?.cardType === 'Ascended Hero');
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return;

      const cardDB = engine._getCardDB();

      // Build deduplicated gallery of Ascended Heroes in deck
      const seen = new Set();
      const galleryCards = [];
      for (const cardName of (ps.mainDeck || [])) {
        if (seen.has(cardName)) continue;
        const cd = cardDB[cardName];
        if (!cd || cd.cardType !== 'Ascended Hero') continue;
        seen.add(cardName);
        galleryCards.push({ name: cardName, source: 'deck' });
      }
      galleryCards.sort((a, b) => a.name.localeCompare(b.name));

      if (galleryCards.length === 0) {
        engine.log('effect_fizzle', { card: 'Graveyard Gathering', reason: 'no_ascended_heroes' });
        return;
      }

      // If only 1 option, auto-select
      let chosenName;
      if (galleryCards.length === 1) {
        chosenName = galleryCards[0].name;
      } else {
        const result = await engine.promptGeneric(pi, {
          type: 'cardGallery',
          cards: galleryCards,
          title: 'Graveyard Gathering',
          description: 'Choose an Ascended Hero from your deck to add to your hand.',
          cancellable: false,
        });
        chosenName = result?.cardName;
        if (!chosenName || !seen.has(chosenName)) chosenName = galleryCards[0].name;
      }

      // Remove from deck and add to hand
      const idx = ps.mainDeck.indexOf(chosenName);
      if (idx < 0) return;
      ps.mainDeck.splice(idx, 1);
      ps.hand.push(chosenName);

      // Reveal to opponent (opponent confirms)
      await engine.revealSearchedCards(pi, [chosenName], 'Graveyard Gathering');

      // Shuffle deck
      engine.shuffleDeck(pi);
    },
  },
};
