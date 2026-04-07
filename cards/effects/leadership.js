// ═══════════════════════════════════════════
//  CARD EFFECT: "Leadership"
//  Ability — Free activation (Main Phase).
//  Hard once per turn.
//
//  Lv1: Select up to 1 card from hand, shuffle
//       back into deck, draw that many.
//  Lv2: Select up to 3 cards.
//  Lv3: Select up to 5 cards, draw +1 bonus.
//
//  Uses the handPick prompt system for in-hand
//  multi-select with dynamic max.
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['ability'],
  freeActivation: true,

  canFreeActivate(ctx, level) {
    const pi = ctx.cardOwner;
    const ps = ctx.players[pi];
    if (!ps || (ps.hand || []).length === 0) return false;
    return true;
  },

  onFreeActivate: async (ctx, level) => {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    if (!ps || (ps.hand || []).length === 0) return false;

    const maxSelect = level >= 3 ? 5 : level >= 2 ? 3 : 1;
    const bonusDraw = level >= 3 ? 1 : 0;
    const actualMax = Math.min(maxSelect, ps.hand.length);

    // Build eligible indices (all cards in hand)
    const eligibleIndices = ps.hand.map((_, i) => i);

    const result = await engine.promptGeneric(pi, {
      type: 'handPick',
      title: `Leadership Lv${level}`,
      description: `Select up to ${actualMax} card${actualMax !== 1 ? 's' : ''} to shuffle back and redraw.${bonusDraw ? ' (+1 bonus draw!)' : ''}`,
      eligibleIndices,
      maxSelect: actualMax,
      minSelect: 1,
      confirmLabel: '🔄 Mulligan!',
      cancellable: true,
    });

    if (!result || result.cancelled || !result.selectedCards || result.selectedCards.length === 0) return false;

    const selectedCards = result.selectedCards;
    const count = selectedCards.length;

    // Sort indices descending so splicing doesn't shift later indices
    const sortedByIdx = [...selectedCards].sort((a, b) => b.handIndex - a.handIndex);

    // Shuffle selected cards back into deck (with slide animation)
    gs.handReturnToDeck = true;
    for (const sel of sortedByIdx) {
      const idx = ps.hand.indexOf(sel.cardName);
      if (idx >= 0) {
        ps.hand.splice(idx, 1);
        ps.mainDeck.push(sel.cardName);
        // Untrack hand instance
        const inst = engine.cardInstances.find(c =>
          c.owner === pi && c.zone === 'hand' && c.name === sel.cardName
        );
        if (inst) engine._untrackCard(inst.id);
        engine.sync();
        await engine._delay(150);
      }
    }
    gs.handReturnToDeck = false;

    // Shuffle deck (Fisher-Yates)
    const deck = ps.mainDeck;
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    engine.log('leadership_shuffle', {
      player: ps.username, count, level, bonus: bonusDraw,
    });
    engine.sync();
    await engine._delay(400);

    // Draw replacement cards + bonus
    const totalDraw = count + bonusDraw;
    for (let i = 0; i < totalDraw; i++) {
      if ((ps.mainDeck || []).length === 0) break;
      await engine.actionDrawCards(pi, 1);
      engine.sync();
      await engine._delay(200);
    }

    engine.sync();
    return true;
  },
};
