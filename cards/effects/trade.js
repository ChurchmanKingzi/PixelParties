// ═══════════════════════════════════════════
//  CARD EFFECT: "Trade"
//  Ability — Free activation during Main Phase
//  (no action cost). Hard once per turn (by name).
//
//  Send the top 5 cards of your deck to the
//  deleted pile (face-up, one by one), then
//  gain Gold based on level:
//  Lv1: 5 Gold, Lv2: 10 Gold, Lv3: 20 Gold.
//
//  Cannot activate with <5 cards in deck.
// ═══════════════════════════════════════════

const GOLD_BY_LEVEL = [5, 10, 20]; // index 0 = Lv1, etc.

module.exports = {
  activeIn: ['ability'],
  freeActivation: true,

  // CPU threat assessment: per level, sends top 5 cards to deleted pile in
  // exchange for gold. We surface only the gold side; the 5-card cost is
  // approximated as zero (those cards would typically be dead/extra draws).
  supportYield(level) {
    return { goldPerTurn: GOLD_BY_LEVEL[Math.min(level - 1, GOLD_BY_LEVEL.length - 1)] };
  },

  // Hard refuse when deck-out is a real threat. The global MCTS eval
  // already penalizes thin-deck states, but Trade's confirm prompt is
  // reached via the generic activation path and deserves an explicit
  // guard: once the deck is ≤ 20 OR the opponent has shown any mill
  // capability, the 5-card burn is net-negative regardless of gold
  // payoff. This composes with the eval term (defence in depth).
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.type !== 'confirm') return undefined;
    if (!/^Trade$/i.test(promptData.title || '')) return undefined;
    const pi = engine._cpuPlayerIdx;
    const ps = engine.gs.players[pi];
    if (!ps) return undefined;
    const deckSize = (ps.mainDeck || []).length;
    if (deckSize <= 20 || ps._oppHasMilledMe) return { confirmed: false };
    // Healthy deck → actually confirm. Returning undefined would let the
    // default brain DECLINE this cancellable confirm (it no longer
    // auto-confirms), making Trade dead for the CPU.
    return { confirmed: true };
  },

  /**
   * Can activate if the player has at least 5 cards in their deck.
   */
  canFreeActivate(ctx, level) {
    const ps = ctx.players[ctx.cardOwner];
    return (ps.mainDeck || []).length >= 5;
  },

  /**
   * Execute: confirm → send top 5 to deleted one by one → gain gold.
   * Returns true if resolved, false if cancelled (don't claim HOPT).
   */
  async onFreeActivate(ctx, level) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];

    if ((ps.mainDeck || []).length < 5) return false;

    const goldGain = GOLD_BY_LEVEL[Math.min(level - 1, GOLD_BY_LEVEL.length - 1)];

    // Confirm
    const confirmed = await ctx.promptConfirmEffect({
      title: 'Trade',
      message: `Trade away the top 5 cards of your deck for ${goldGain} Gold?`,
    });
    if (!confirmed) return false;

    // Collect the top 5 cards
    const cards = ps.mainDeck.splice(0, 5);

    engine.log('trade', { player: ps.username, cards, goldGain, level });

    // Flug UND getaktete Landung liegen seit 16.8. in der Engine
    // (`actionDeleteFromDeckAnimated`). Frueher wurden hier alle fuenf
    // Karten sofort in den Stapel gelegt und einmal synchronisiert —
    // die LETZTE lag damit schon obenauf, waehrend die erste noch flog
    // (Als Report). Jetzt landet jede Karte, wenn ihr Flug ankommt.
    // Die Wartezeit steckt in der Primitive; `settle` deckt den
    // Nachlauf der letzten Flugkarte ab, damit der Goldgewinn danach
    // nicht in die noch laufende Animation faellt.
    await engine.actionDeleteFromDeckAnimated(pi, cards, { settle: 200 });

    // Gain gold (actionGainGold fires hooks + auto-syncs + frontend auto-detects the gain)
    await engine.actionGainGold(pi, goldGain);

    engine.sync();
    return true;
  },
};
