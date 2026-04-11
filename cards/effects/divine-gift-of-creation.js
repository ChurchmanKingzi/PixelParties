// ═══════════════════════════════════════════
//  CARD EFFECT: "Divine Gift of Creation"
//  Spell (Support Magic Lv1) — Inherent additional
//  Action. Once per game (Divine Gift).
//  Search deck for up to 2 cards with different
//  names, reveal and add to hand. If 2 chosen,
//  those names are locked for the rest of the turn.
// ═══════════════════════════════════════════

module.exports = {
  inherentAction: true,
  oncePerGame: true,
  oncePerGameKey: 'divineGift',

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      const heroIdx = ctx.cardHeroIdx;
      if (!ps) return;

      const cardDB = engine._getCardDB();

      // Build deduplicated gallery of all cards in deck
      const seen = new Set();
      const galleryCards = [];
      for (const cn of (ps.mainDeck || [])) {
        if (seen.has(cn)) continue;
        const cd = cardDB[cn];
        if (!cd) continue;
        seen.add(cn);
        galleryCards.push({ name: cn, source: 'deck' });
      }
      galleryCards.sort((a, b) => a.name.localeCompare(b.name));

      if (galleryCards.length === 0) return;

      // Prompt: pick up to 2 different cards
      const maxPicks = Math.min(2, galleryCards.length);
      const result = await engine.promptGeneric(pi, {
        type: 'cardGalleryMulti',
        cards: galleryCards,
        selectCount: maxPicks,
        minSelect: 1,
        title: 'Divine Gift of Creation',
        description: `Search your deck for up to ${maxPicks} card${maxPicks > 1 ? 's' : ''} with different names.`,
        confirmLabel: '✨ Create!',
        confirmClass: 'btn-success',
        cancellable: true,
      });

      if (!result || result.cancelled || !result.selectedCards || result.selectedCards.length === 0) {
        gs._spellCancelled = true;
        return;
      }

      const chosen = result.selectedCards;

      // Move chosen cards from deck to hand
      for (const name of chosen) {
        const idx = ps.mainDeck.indexOf(name);
        if (idx >= 0) {
          ps.mainDeck.splice(idx, 1);
          ps.hand.push(name);
        }
      }

      // Reveal chosen cards to opponent one by one (opponent confirms each)
      await engine.revealSearchedCards(pi, chosen, 'Divine Gift of Creation');

      // If 2 cards chosen: lock those names for the rest of the turn
      if (chosen.length >= 2) {
        if (!ps._creationLockedNames) ps._creationLockedNames = new Set();
        for (const name of chosen) {
          ps._creationLockedNames.add(name);
        }
        engine.log('creation_lock', { player: ps.username, cards: chosen });
      }

      // Shuffle deck
      for (let i = ps.mainDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ps.mainDeck[i], ps.mainDeck[j]] = [ps.mainDeck[j], ps.mainDeck[i]];
      }

      engine.sync();
    },
  },
};
