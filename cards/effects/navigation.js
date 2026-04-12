// ═══════════════════════════════════════════
//  CARD EFFECT: "Navigation"
//  Ability — Free activation (Main Phase).
//  Hard once per turn.
//
//  Discard 3/2/2 copies of the same card from
//  hand (by level), then search deck for any
//  card, reveal it, and add to hand.
//  Lv1–2: hand is locked afterwards (no draws
//  or hand additions for the rest of the turn).
//
//  Uses filtered forceDiscard — only cards with
//  enough copies are eligible, and after the
//  first pick only copies of that card remain.
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['ability'],
  freeActivation: true,
  blockedByHandLock: true,

  canFreeActivate(ctx, level) {
    const ps = ctx.players[ctx.cardOwner];
    if (ps.handLocked) return false;
    const requiredCopies = level >= 2 ? 2 : 3;
    // Count card occurrences in hand
    const counts = {};
    for (const cn of (ps.hand || [])) {
      counts[cn] = (counts[cn] || 0) + 1;
    }
    // Need at least one card with enough copies AND cards in deck
    if (!Object.values(counts).some(c => c >= requiredCopies)) return false;
    if ((ps.mainDeck || []).length === 0) return false;
    return true;
  },

  async onFreeActivate(ctx, level) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    const requiredCopies = level >= 2 ? 2 : 3;
    const lockAfter = level <= 2;

    // ── Step 1: Discard N copies of the same card ──

    // Build set of card names with enough copies
    const counts = {};
    for (const cn of (ps.hand || [])) {
      counts[cn] = (counts[cn] || 0) + 1;
    }
    const eligibleNames = new Set(
      Object.entries(counts)
        .filter(([, c]) => c >= requiredCopies)
        .map(([name]) => name)
    );
    if (eligibleNames.size === 0) return false;

    let chosenCardName = null;

    for (let i = 0; i < requiredCopies; i++) {
      const remaining = requiredCopies - i;

      // Build eligible indices for this step
      const eligibleIndices = [];
      for (let idx = 0; idx < ps.hand.length; idx++) {
        const cn = ps.hand[idx];
        if (chosenCardName) {
          if (cn === chosenCardName) eligibleIndices.push(idx);
        } else {
          if (eligibleNames.has(cn)) eligibleIndices.push(idx);
        }
      }

      if (eligibleIndices.length === 0) return false;

      const result = await engine.promptGeneric(pi, {
        type: 'forceDiscard',
        count: 1,
        title: `Navigation Lv${level}`,
        description: chosenCardName
          ? `Discard ${remaining} more copy${remaining > 1 ? ' copies' : ''} of ${chosenCardName}.`
          : `Choose a card to discard ${requiredCopies} copies of.${lockAfter ? ' (Hand will be locked afterwards.)' : ''}`,
        eligibleIndices,
        cancellable: false,
      });

      if (!result || result.cardName == null) {
        // Safety fallback — pick first eligible
        const fallbackIdx = eligibleIndices[0];
        const fallbackName = ps.hand[fallbackIdx];
        if (!chosenCardName) chosenCardName = fallbackName;
        ps.hand.splice(fallbackIdx, 1);
        ps.discardPile.push(fallbackName);
      } else {
        if (!chosenCardName) chosenCardName = result.cardName;

        const handIdx = (result.handIndex != null && result.handIndex >= 0 && ps.hand[result.handIndex] === result.cardName)
          ? result.handIndex
          : ps.hand.indexOf(result.cardName);
        if (handIdx < 0) return false;

        ps.hand.splice(handIdx, 1);
        ps.discardPile.push(result.cardName);
      }

      // Untrack hand instance
      const inst = engine.findCards({ owner: pi, zone: 'hand', name: chosenCardName })[0];
      if (inst) {
        inst.zone = 'discard';
        await engine.runHooks('onDiscard', {
          playerIdx: pi, card: inst, cardName: chosenCardName, _skipReactionCheck: true,
        });
      }

      engine.log('navigation_discard', { player: ps.username, card: chosenCardName });
      engine.sync();
      await engine._delay(200);
    }

    // ── Step 2: Search deck for any card ──

    if ((ps.mainDeck || []).length === 0) {
      if (lockAfter) ctx.lockHand();
      engine.sync();
      return true;
    }

    // Build deduplicated gallery from deck
    const deckCounts = {};
    for (const cn of ps.mainDeck) {
      deckCounts[cn] = (deckCounts[cn] || 0) + 1;
    }
    const galleryCards = Object.entries(deckCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({ name, source: 'deck', count }));

    if (galleryCards.length === 0) {
      if (lockAfter) ctx.lockHand();
      engine.sync();
      return true;
    }

    const searchResult = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: galleryCards,
      title: `Navigation Lv${level}`,
      description: 'Choose a card to add to your hand.',
      cancellable: false,
    });

    if (!searchResult || !searchResult.cardName) {
      if (lockAfter) ctx.lockHand();
      engine.sync();
      return true;
    }

    // Verify card is in deck
    const deckIdx = ps.mainDeck.indexOf(searchResult.cardName);
    if (deckIdx < 0) {
      if (lockAfter) ctx.lockHand();
      engine.sync();
      return true;
    }

    // Move card from deck to hand
    ps.mainDeck.splice(deckIdx, 1);
    ps.hand.push(searchResult.cardName);

    // ── Step 3: Reveal to opponent ──

    engine._broadcastEvent('deck_search_add', { cardName: searchResult.cardName, playerIdx: pi });
    engine.log('deck_search', { player: ps.username, card: searchResult.cardName, by: 'Navigation' });
    engine.sync();

    await engine._delay(500);
    const oi = pi === 0 ? 1 : 0;
    await engine.promptGeneric(oi, {
      type: 'deckSearchReveal',
      cardName: searchResult.cardName,
      searcherName: ps.username,
      title: 'Navigation',
      cancellable: false,
    });

    // ── Step 4: Lock hand if Lv1 or Lv2 ──

    if (lockAfter) {
      ctx.lockHand();
    }

    engine.sync();
    return true;
  },
};
