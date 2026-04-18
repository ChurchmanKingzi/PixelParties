// ═══════════════════════════════════════════
//  CARD EFFECT: "Loot the Leftovers"
//  Spell (Reaction, Decay Magic Lv1)
//
//  Triggers when ANY player defeats a Hero
//  controlled by their opponent.
//  The Loot player picks 2 face-down cards
//  from the opponent's hand (blind pick) and
//  steals them. Routed through the shared
//  hand-steal helper so all stealing effects
//  stay in sync.
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
   * face-down hand, then steal them. Uses the shared helper, which
   * handles the animation, state mutation, and the first-turn
   * protection + empty-hand fizzle branches automatically.
   */
  resolve: async (engine, pi) => {
    const gs = engine.gs;
    const oppIdx = pi === 0 ? 1 : 0;
    const oppPs = gs.players[oppIdx];
    if (!oppPs || (oppPs.hand || []).length < 2) return;

    // Show card to both players
    engine._broadcastEvent('card_reveal', {
      cardName: 'Loot the Leftovers', playerIdx: pi,
    });

    await engine.actionStealFromHand(pi, {
      count: 2,
      title: 'Loot the Leftovers',
      sourceName: 'Loot the Leftovers',
      cancellable: false, // Reaction resolves once — no backing out.
    });
  },
};
