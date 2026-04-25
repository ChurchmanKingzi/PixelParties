// ═══════════════════════════════════════════
//  CARD EFFECT: "Bamboo Shield"
//  Artifact (Reaction, Cost 20)
//
//  Play this card immediately when a Hero would
//  take any damage. Negate that damage to that
//  Hero. When this card is added to your hand
//  from your discard pile, you may permanently
//  reveal it to make its Cost become 8. You can
//  only play 1 'Bamboo Shield' per turn.
//
//  Wiring:
//    • Pre-damage hand reaction window
//      (`isPreDamageReaction`). Same scaffold the
//      engine uses for Homerun! / Smug Coin /
//      Loyal Bone Dog.
//    • DAMAGE-ONLY negate: returns
//      `{ amountOverride: 0 }` so the hit still
//      LANDS — animations, afterDamage, armed-
//      arrow riders, on-hit status application
//      (Reiza's Poison + Stun, Hydra Blood
//      poison-from-would-have-damage, …) all
//      continue to fire — but the dealt amount
//      is pinned to zero. Cleanly distinguishes
//      "block the damage" from "block the entire
//      attack".
//    • Cost discount: revealing a copy stamps
//      its hand index in
//      `ps._permanentlyRevealedHandIndices` (a
//      sibling of Luna Kiai's per-turn
//      `_revealedHandIndices` that NEVER expires
//      at turn rollover). The engine's hand
//      splice interceptor auto-rebases / drops
//      indices on every hand mutation, so the
//      stamp is exact — present iff the revealed
//      copy is still physically in hand. The
//      `dynamicCost` lookup walks the map and
//      returns 8 iff at least one of the revealed
//      indices is still pointing at a Bamboo
//      Shield, otherwise 20. Net effect: the
//      discount evaporates the instant the
//      revealed copy is spliced out (played,
//      discarded, deleted) — so a freshly drawn
//      un-revealed copy correctly costs 20 again,
//      matching the "this card" wording.
//    • 1-per-turn: HOPT key keyed by player.
//      Claimed when the resolver actually runs,
//      so a declined prompt does NOT consume the
//      slot.
// ═══════════════════════════════════════════

const CARD_NAME = 'Bamboo Shield';
const BASE_COST = 20;
const REVEALED_COST = 8;

module.exports = {
  isPreDamageReaction: true,

  // Strictly reactive — never proactively playable, never a chain-link
  // candidate. Hand cards stay dimmed in the regular UI like other
  // pre-damage reactions (Bone Dog, Smug Coin, etc.).
  canActivate: () => false,
  neverPlayable: true,
  activeIn: ['hand'],

  /**
   * Cost gate read by both `_checkPreDamageHandReactions` and the
   * chain-reaction window. Drops the price to 8 iff the player has
   * at least one currently-revealed Bamboo Shield in hand. The
   * `_permanentlyRevealedHandIndices` map is auto-rebased by the
   * engine's hand splice interceptor, so an index becomes invalid
   * the instant its slot is spliced out (played, discarded, deleted)
   * — so the discount auto-reverts when no revealed copy remains
   * to consume.
   */
  dynamicCost(gs, playerIdx /*, engine */) {
    const ps = gs?.players?.[playerIdx];
    if (!ps) return BASE_COST;
    const map = ps._permanentlyRevealedHandIndices;
    if (!map) return BASE_COST;
    for (const kStr of Object.keys(map)) {
      const k = +kStr;
      if (ps.hand?.[k] === CARD_NAME) return REVEALED_COST;
    }
    return BASE_COST;
  },

  /**
   * Trigger condition — the engine offers the prompt only when the
   * dying Hero is on this card's controller side AND the per-turn
   * lockout is unclaimed. The HOPT itself isn't claimed here (the
   * resolver does it) so a declined prompt costs nothing.
   */
  preDamageCondition(gs, ownerIdx /*, engine, target, heroIdx, source, amount, type */) {
    const hoptKey = `bamboo_shield:${ownerIdx}`;
    if (gs.hoptUsed?.[hoptKey] === gs.turn) return false;
    return true;
  },

  /**
   * Pin the damage to 0 without cancelling the entry. Animations,
   * afterDamage, on-hit status application (Reiza's Poison + Stun,
   * etc.) all fire normally — only HP loss is removed. Claims the
   * once-per-turn slot at this point so cancellable prompts above
   * the resolver don't burn it.
   */
  async preDamageResolve(engine, ownerIdx /*, target, heroIdx, source, amount, type */) {
    if (!engine.claimHOPT(`bamboo_shield`, ownerIdx)) {
      // Defensive — preDamageCondition should have already rejected.
      return { amountOverride: undefined };
    }

    const ps = engine.gs.players[ownerIdx];
    engine.log('bamboo_shield_negate', {
      player: ps?.username,
    });
    return { amountOverride: 0 };
  },

  hooks: {
    /**
     * When a Bamboo Shield is recovered into our hand, prompt the
     * controller: permanently reveal it to drop ALL future Bamboo
     * Shields' cost to 8? The reveal is sticky for the whole game
     * (player-level flag); subsequent recoveries can still re-prompt
     * if the flag was somehow unset, but in practice the first reveal
     * locks in the discount.
     */
    onCardAddedFromDiscardToHand: async (ctx) => {
      // Only react to OUR own copy entering OUR hand.
      if (ctx.playerIdx !== ctx.cardOwner) return;
      if (ctx.addedCardName !== CARD_NAME) return;
      // Filter to the freshly-recovered instance — without this, every
      // existing Bamboo Shield in hand would also fire the prompt.
      if (ctx.addedCard?.id !== ctx.card.id) return;

      const engine = ctx._engine;
      const gs     = engine.gs;
      const pi     = ctx.cardOwner;
      const ps     = gs.players[pi];
      if (!ps) return;

      // Find the just-recovered copy's hand index. The helper pushes
      // to the end of hand right before firing the hook, so walk
      // backwards for the most-recent matching name to be robust
      // against any hand mutation that might happen between push and
      // here.
      let handIndex = -1;
      for (let i = ps.hand.length - 1; i >= 0; i--) {
        if (ps.hand[i] !== CARD_NAME) continue;
        // Skip indices already permanently revealed (older copies that
        // were revealed earlier this game) so we don't keep re-prompting
        // for them.
        if (ps._permanentlyRevealedHandIndices?.[i]) continue;
        handIndex = i;
        break;
      }
      if (handIndex < 0) return;

      const confirmed = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `${CARD_NAME} returned to your hand! Permanently reveal it to drop ${CARD_NAME}'s cost to ${REVEALED_COST}?`,
        showCard: CARD_NAME,
        confirmLabel: '🎋 Reveal!',
        cancelLabel: 'No',
        cancellable: true,
      });
      if (!confirmed) return;

      // Re-find the hand index after the prompt — by the time the
      // player confirms, hand-mutating effects (none currently, but
      // defensive against future ones) may have shifted positions.
      // Match by name, skipping already-revealed slots.
      let confirmIndex = -1;
      for (let i = ps.hand.length - 1; i >= 0; i--) {
        if (ps.hand[i] !== CARD_NAME) continue;
        if (ps._permanentlyRevealedHandIndices?.[i]) continue;
        confirmIndex = i;
        break;
      }
      if (confirmIndex < 0) return;

      // Per-instance reveal flag (counter) so per-copy effects (future
      // "is this Shield revealed?" reads) work reliably. The actual
      // cost-discount lookup walks `_permanentlyRevealedHandIndices`
      // (see `dynamicCost`) so the discount evaporates the moment
      // the revealed copy is spliced out of hand.
      ctx.card.counters._bambooRevealed = true;

      // Permanent per-index reveal — survives turn boundaries (no
      // turn-start cleanup wipes _permanentlyRevealedHandIndices) and
      // auto-rebases on splice via the engine's hand interceptor.
      // Cleared automatically when this copy is spliced out of hand
      // (played, discarded, deleted).
      if (!ps._permanentlyRevealedHandIndices) ps._permanentlyRevealedHandIndices = {};
      ps._permanentlyRevealedHandIndices[confirmIndex] = true;

      // Mirror the Luna Kiai pattern — broadcast the card reveal so
      // both players see the moment the copy flips face-up.
      engine._broadcastEvent('card_reveal', {
        cardName: CARD_NAME, playerIdx: pi,
      });

      engine.log('bamboo_shield_revealed', {
        player: ps.username,
      });
      engine.sync();
    },
  },
};
