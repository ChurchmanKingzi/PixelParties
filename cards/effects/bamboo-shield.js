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
//      `ps._permanentlyRevealedHandIndices[handIdx]
//      = true` — the SAME generic per-hand-index
//      registry Rocky Slime's level offset and
//      Luna Kiai's per-turn reveal use. The
//      registry's splice interceptor and
//      `reorder_hand` remap automatically keep
//      the entry pinned to the physical copy
//      across hand mutations (drag-reorder,
//      splice from mid-hand, etc.) — fixes the
//      old index-bound bug where reordering the
//      Shield in hand silently transferred the
//      discount onto another card. When the
//      revealed copy is eventually played /
//      discarded / deleted, the splice rebase
//      drops its entry — and therefore the
//      discount — automatically. A freshly drawn
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

/** True iff `ps` has at least one Bamboo Shield in hand at a revealed index. */
function hasRevealedCopy(ps) {
  const map = ps?._permanentlyRevealedHandIndices;
  if (!map) return false;
  for (const kStr of Object.keys(map)) {
    if ((ps.hand || [])[+kStr] === CARD_NAME) return true;
  }
  return false;
}

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
   * at least one currently-revealed Bamboo Shield in hand.
   */
  dynamicCost(gs, playerIdx /* , engine */) {
    const ps = gs?.players?.[playerIdx];
    return hasRevealedCopy(ps) ? REVEALED_COST : BASE_COST;
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
     * controller: permanently reveal THIS copy to lock the cost
     * discount? The reveal entry lives in the engine's generic
     * `_permanentlyRevealedHandIndices` map — keyed by the resolved
     * handIndex of the just-arrived inst, so the splice interceptor
     * and `reorder_hand` remap follow the physical copy through any
     * hand mutation. When the revealed copy is eventually played /
     * discarded / deleted, the rebase drops its entry and the
     * discount disappears with it.
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

      // Resolve this inst's current hand index. Already-revealed → bail.
      const handIdx = engine._findHandIndexForInst(ctx.card);
      if (handIdx < 0) return;
      if (ps._permanentlyRevealedHandIndices?.[handIdx]) return;

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

      // Re-resolve handIndex post-prompt — async windows can shift hand
      // state. Bail if the inst left hand mid-prompt.
      const handIdxNow = engine._findHandIndexForInst(ctx.card);
      if (handIdxNow < 0) return;

      if (!ps._permanentlyRevealedHandIndices) ps._permanentlyRevealedHandIndices = {};
      ps._permanentlyRevealedHandIndices[handIdxNow] = true;

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
