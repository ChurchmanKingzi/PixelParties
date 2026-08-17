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
  // Unter Hand-/Zieh-Lock NICHT zünden (Als Report 1.8.): Leadership
  // mischt Handkarten ins Deck und zieht dieselbe Anzahl nach. Ist das
  // Ziehen gesperrt (The Sacred Jewel setzt `ps.drawLocked`), liefert
  // die Ziehfunktion [] — die Karten sind weg, nachgezogen wird nichts.
  // Gilt auf ALLEN Stufen, denn alle drei ziehen.
  //
  // Nur eine CPU-Regel: der Engine-Pfad für Menschen bleibt bewusst
  // unangetastet, wie schon bei Alchemy.
  cpuSkipActivationWhenDrawLocked: true,
  // Shuffles hand cards back into the deck — flagged for "No Retreat!"
  // detection.
  shufflesFromHandOrDiscardIntoDeck: true,

  // CPU threat assessment: mulligan nets zero cards at Lv1/2 (replaces same
  // count); only Lv3 adds +1 bonus draw. Card-filtering value not modeled.
  supportYield(level) {
    return { drawsPerTurn: level >= 3 ? 1 : 0 };
  },

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
    // ── Zurueckmisch-Sperre (Hatusbal / Distracting Crystal) ──
    // Ist das Zurueckmischen ins EIGENE Deck gesperrt, bleiben nur
    // GESTOHLENE Karten waehlbar — die gehen ins Deck ihres Besitzers
    // zurueck, und das ist nicht "their deck" im Sinne von Hatusbals
    // Text (Als Ruling 16.8.).
    const waehlbar = new Set(engine.shuffleBackEligibleHandCards(pi));
    const eligibleIndices = ps.hand
      .map((_, i) => i)
      .filter(i => waehlbar.has(ps.hand[i]));
    if (eligibleIndices.length === 0) return false;

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
    const cardNamesToReturn = sortedByIdx.map(s => s.cardName);

    // Mulligan cards back to deck (handles animation, opponent routing, shuffling)
    const { potionCount, totalReturned } = await engine.actionMulliganCards(pi, cardNamesToReturn);

    engine.log('leadership_shuffle', {
      player: ps.username, count, returned: totalReturned, level, bonus: bonusDraw,
    });
    engine.sync();
    await engine._delay(400);

    // Draw replacement cards: non-potions from main deck, potions from potion deck, + bonus from main
    // ★ Als Regel (17.8.): "the same number" meint ALLE
    // zurueckgemischten Karten — auch gestohlene, die ins
    // GEGNER-Deck gingen. `totalReturned` zaehlt beide Decks;
    // die frueher benutzte Auswahlmenge haette bei einem
    // fehlgeschlagenen Rueckweg zu viel gezogen.
    const mainToDraw = totalReturned - potionCount + bonusDraw;
    await engine.actionDrawCards(pi, mainToDraw);
    for (let i = 0; i < potionCount; i++) {
      if ((ps.potionDeck || []).length === 0) break;
      const potionCard = ps.potionDeck.shift();
      ps.hand.push(potionCard);
      engine.sync();
      await engine._delay(200);
    }

    engine.sync();
    return true;
  },
};
