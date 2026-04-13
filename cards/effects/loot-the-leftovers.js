// ═══════════════════════════════════════════
//  CARD EFFECT: "Loot the Leftovers"
//  Spell (Reaction, Decay Magic Lv1)
//
//  Triggers when ANY player defeats a Hero
//  controlled by their opponent.
//  The Loot player picks 2 random face-down
//  cards from the opponent's hand (blind pick)
//  and steals them.
//
//  Condition: opponent must have 2+ cards in hand.
// ═══════════════════════════════════════════

module.exports = {
  isReaction: true,

  /**
   * Reaction condition: only prompt when a hero was just killed
   * by a player who is NOT that hero's owner, and the Loot
   * owner's opponent has 2+ cards in hand.
   */
  reactionCondition: (gs, pi, engine, chainCtx) => {
    // Must be reacting to a hero KO event
    const koCtx = gs._heroKOContext;
    if (!koCtx) return false;

    // The kill must be cross-player (killer ≠ hero owner)
    if (koCtx.killerOwner < 0) return false;
    if (koCtx.killerOwner === koCtx.heroOwner) return false;

    // Opponent must have 2+ cards in hand
    const oppIdx = pi === 0 ? 1 : 0;
    const oppPs = gs.players[oppIdx];
    if (!oppPs || (oppPs.hand || []).length < 2) return false;

    // At least 1 hero must be able to cast this (Decay Magic Lv1)
    if (engine) {
      let canCast = false;
      const ps = gs.players[pi];
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        if (engine._canHeroActivateSurprise(pi, hi, 'Loot the Leftovers')) {
          canCast = true; break;
        }
      }
      if (!canCast) return false;
    }

    return true;
  },

  /**
   * Resolve: prompt the player to blind-pick 2 cards from opponent's
   * face-down hand, then steal them.
   */
  resolve: async (engine, pi) => {
    const gs = engine.gs;
    const ps = gs.players[pi];
    const oppIdx = pi === 0 ? 1 : 0;
    const oppPs = gs.players[oppIdx];

    if (!oppPs || (oppPs.hand || []).length < 2) return;

    // Show card to both players
    engine._broadcastEvent('card_reveal', {
      cardName: 'Loot the Leftovers', playerIdx: pi,
    });

    // Prompt the Loot player to blind-pick 2 cards
    const result = await engine.promptGeneric(pi, {
      type: 'blindHandPick',
      title: 'Loot the Leftovers',
      description: `Pick 2 cards from ${oppPs.username}'s hand to steal.`,
      maxSelect: 2,
      confirmLabel: '🫳 Steal!',
      oppHandCount: oppPs.hand.length,
    });

    if (!result || !result.selectedIndices || result.selectedIndices.length < 2) return;

    // Validate indices
    const indices = result.selectedIndices
      .filter(i => i >= 0 && i < oppPs.hand.length)
      .sort((a, b) => b - a); // Sort descending for safe splicing

    if (indices.length < 2) return;

    // Take only 2
    const toSteal = indices.slice(0, 2).sort((a, b) => a - b);

    // Get card names before moving (for animation)
    const cardNames = toSteal.map(idx => oppPs.hand[idx]).filter(Boolean);

    // Broadcast steal animation BEFORE moving cards (so positions are correct)
    engine._broadcastEvent('play_hand_steal', {
      fromPlayer: oppIdx,
      toPlayer: pi,
      indices: toSteal,
      cardNames,
      count: toSteal.length,
      duration: 800,
    });
    await engine._delay(2000);

    // Now move the cards (splice descending to preserve indices)
    const stolenCards = [];
    for (const idx of toSteal.sort((a, b) => b - a)) {
      const cardName = oppPs.hand[idx];
      if (!cardName) continue;
      oppPs.hand.splice(idx, 1);
      ps.hand.push(cardName);
      stolenCards.push(cardName);

      // Update tracked instance: owner changes to holder, originalOwner preserved
      const inst = engine.cardInstances.find(c =>
        c.owner === oppIdx && c.zone === 'hand' && c.name === cardName
      );
      if (inst) {
        inst.owner = pi;
        inst.controller = pi;
      }
    }

    if (stolenCards.length === 0) return;

    engine.log('loot_the_leftovers', {
      player: ps.username,
      stolen: stolenCards.length,
      from: oppPs.username,
    });
    engine.sync();
  },
};
