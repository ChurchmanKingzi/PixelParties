// ═══════════════════════════════════════════
//  CARD EFFECT: "Elana, the Rocky Rebel"
//  Hero — Active effect (once per turn, Main Phase).
//  Shuffle your entire hand back into the deck,
//  then draw the same number of cards +1.
//  Requires at least 1 card in hand.
//  Animation: big burst of music notes over Elana.
// ═══════════════════════════════════════════

module.exports = {
  // CPU: confirm this Hero's activated-effect "you may" prompt — the default
  // brain declines cancellable confirms raised outside a card-cast (Hero
  // effect activations don't set _resolvingCard), which would otherwise make
  // the effect a no-op even after the CPU chose to activate it. (Title must
  // equal the card name for this lookup.)
  cpuResponse(engine, kind, promptData) {
    if (promptData?.type === 'confirm' && !promptData.showCard) return { confirmed: true };
    return undefined;
  },
  activeIn: ['hero'],
  heroEffect: true,
  // Shuffles hand back into deck — flagged for "No Retreat!"
  // detection.
  shufflesIntoDeck: true,

  // CPU threat assessment: net +1 draw per activation (refills hand + 1).
  supportYield() {
    return { drawsPerTurn: 1 };
  },

  /**
   * Can activate if the player has at least 1 card in hand.
   */
  canActivateHeroEffect(ctx) {
    const pi = ctx.cardOwner;
    const ps = ctx.players[pi];
    return (ps.hand || []).length >= 1;
  },

  /**
   * Execute: confirm → play music note animation → return hand to deck
   * one by one → shuffle → draw (handSize + 1) one by one.
   * Returns true if resolved, false if cancelled.
   */
  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const ps = ctx.players[pi];

    const handSize = (ps.hand || []).length;
    if (handSize < 1) return false;

    const drawCount = handSize + 1;

    // Confirm
    const confirmed = await ctx.promptConfirmEffect({
      title: 'Elana, the Rocky Rebel',
      message: `Shuffle ${handSize} card${handSize !== 1 ? 's' : ''} back into your deck to draw ${drawCount}?`,
    });
    if (!confirmed) return false;

    // Play music notes animation on Elana
    engine._broadcastEvent('play_zone_animation', {
      type: 'music_notes', owner: pi, heroIdx, zoneSlot: -1,
    });
    await engine._delay(400);

    // Return all hand cards to deck
    const cardNamesToReturn = [...ps.hand];
    await engine.actionMulliganCards(pi, cardNamesToReturn);

    await engine._delay(400);

    engine.log('elana_shuffle', { player: ps.username, returned: cardNamesToReturn.length, drawing: drawCount });

    await engine._delay(300);

    await engine.actionDrawCards(pi, drawCount);

    engine.sync();
    return true;
  },
};
