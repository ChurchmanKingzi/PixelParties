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
        costFor: 'Navigation',          // ★ v1041: Kosten-Abwurf-Lernkanal
        costKind: 'tutor',
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
        await engine.actionDiscardHandCard(pi, fallbackName, fallbackIdx, { source: 'Navigation', _noGlow: true });   // v1394
      } else {
        if (!chosenCardName) chosenCardName = result.cardName;

        const handIdx = (result.handIndex != null && result.handIndex >= 0 && ps.hand[result.handIndex] === result.cardName)
          ? result.handIndex
          : ps.hand.indexOf(result.cardName);
        if (handIdx < 0) return false;

        await engine.actionDiscardHandCard(pi, result.cardName, handIdx, { source: 'Navigation', _noGlow: true });   // v1394
      }
      // (v1394: Instanz, onDiscard, Flug und Log macht actionDiscardHandCard.)

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
        searchToHand: true,   // v1119: Suche AUF DIE HAND
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
    if (ps.mainDeck.indexOf(searchResult.cardName) < 0) {
      if (lockAfter) ctx.lockHand();
      engine.sync();
      return true;
    }

    // ── Step 3: Move card from deck to hand + reveal to opponent ──
    // Route through the canonical helper so ON_CARD_ADDED_TO_HAND
    // fires (Cosmic Depths Analyzer / Gatherer counter generators
    // key off this hook for any opp search effect). Helper handles
    // splice + push + tracking + deck-search animation + log +
    // hook + opp reveal.
    await engine.actionAddCardFromDeckToHand(pi, searchResult.cardName, {
      source: 'Navigation',
      reveal: true,
    });

    // ── Step 4: Lock hand if Lv1 or Lv2 ──

    if (lockAfter) {
      ctx.lockHand();
    }

    engine.sync();
    return true;
  },
};
