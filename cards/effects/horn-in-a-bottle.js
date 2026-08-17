// ═══════════════════════════════════════════
//  CARD EFFECT: "Horn in a Bottle"
//  Potion (Normal) — Shuffle any number of
//  cards (0+) from hand back into deck, then
//  draw that many + 1. Follows the Leadership
//  pattern: handPick → shuffle back with
//  animation → draw replacements.
// ═══════════════════════════════════════════

module.exports = {
  // Mischt aus HAND bzw. ABLAGE ins eigene Deck zurueck. Von
  // Distracting Crystal gesperrt und von Hatusbal, the Leader of
  // Tusca mitgelesen. Als Ruling 16.8.: der Krystall deckt NUR
  // Hand und Ablage ab — Brett/Loeschstapel ausdruecklich nicht.
  shufflesFromHandOrDiscardIntoDeck: true,   // Herkunft: Hand

  isPotion: true,
  deferBroadcast: true,

  resolve: async (engine, pi) => {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return { cancelled: true };

    // Find the resolving Horn in a Bottle's index to exclude it from selection
    let resolvingIdx = -1;
    if (ps._resolvingCard) {
      for (let i = 0; i < ps.hand.length; i++) {
        if (ps.hand[i] !== ps._resolvingCard.name) continue;
        const nth = ps.hand.slice(0, i + 1).filter(c => c === ps._resolvingCard.name).length;
        if (nth === ps._resolvingCard.nth) { resolvingIdx = i; break; }
      }
    }

    // Build eligible indices (all hand cards except the resolving potion)
    const waehlbar = new Set(engine.shuffleBackEligibleHandCards(pi));
    const eligibleIndices = ps.hand
      .map((_, i) => i)
      .filter(i => i !== resolvingIdx && waehlbar.has(ps.hand[i]));

    // If no cards to pick from (hand is just the potion), skip picking and draw 1
    if (eligibleIndices.length === 0) {
      // Reveal now — player can't cancel at this point
      engine._broadcastEvent('card_reveal', { cardName: 'Horn in a Bottle' });
      await engine._delay(200);
      await engine.actionDrawCards(pi, 1);
      engine.log('horn_in_a_bottle', { player: ps.username, shuffled: 0, drawn: 1 });
      engine.sync();
      return true;
    }

    const result = await engine.promptGeneric(pi, {
      type: 'handPick',
      title: 'Horn in a Bottle',
      description: `Select any number of cards to shuffle back into your deck. You'll draw that many + 1.`,
      eligibleIndices,
      maxSelect: eligibleIndices.length,
      minSelect: 0,
      confirmLabel: '🔄 Shuffle & Draw!',
      cancellable: true,
    });

    if (!result || result.cancelled) return { cancelled: true };

    // Reveal card to opponent now that the player has committed
    engine._broadcastEvent('card_reveal', { cardName: 'Horn in a Bottle' });
    await engine._delay(200);

    const selectedCards = result.selectedCards || [];
    const count = selectedCards.length;
    // Ausserhalb des Blocks, weil das Protokoll unten beides zeigt:
    // die AUSWAHL (`count`) und das, was wirklich zurueckging.
    let totalReturned = 0;

    if (count > 0) {
      // Sort indices descending so splicing doesn't shift later indices
      const sortedByIdx = [...selectedCards].sort((a, b) => b.handIndex - a.handIndex);
      const cardNamesToReturn = sortedByIdx.map(s => s.cardName);

      // Mulligan cards back to deck (handles animation, opponent routing, shuffling)
      const mulligan = await engine.actionMulliganCards(pi, cardNamesToReturn);
      const potionCount = mulligan.potionCount || 0;
      totalReturned = mulligan.totalReturned || 0;

      engine.sync();
      await engine._delay(400);

      // Draw replacement cards: non-potions from main deck, potions from potion deck, +1 bonus from main
      // ★ Als Regel (17.8.): "the same number" meint ALLE
      // zurueckgemischten Karten — auch gestohlene, die ins
      // GEGNER-Deck gingen. `totalReturned` zaehlt beide Decks;
      // die frueher benutzte Auswahlmenge haette bei einem
      // fehlgeschlagenen Rueckweg zu viel gezogen.
      const mainToDraw = totalReturned - potionCount + 1;
      await engine.actionDrawCards(pi, mainToDraw);
      for (let i = 0; i < potionCount; i++) {
        if ((ps.potionDeck || []).length === 0) break;
        const potionCard = ps.potionDeck.shift();
        ps.hand.push(potionCard);
        engine.sync();
        await engine._delay(200);
      }
    } else {
      // 0 cards selected — just draw 1
      await engine.actionDrawCards(pi, 1);
    }

    engine.log('horn_in_a_bottle', {
      player: ps.username,
      shuffled: count, returned: totalReturned,
      drawn: count + 1,
    });

    engine.sync();
    return true;
  },
};
