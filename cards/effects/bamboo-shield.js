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
//      `_permanentlyRevealed = true` on its
//      CardInstance counters. The instance flag
//      survives every hand mutation (splice,
//      drag-reorder, mid-game inserts) because
//      it lives on the instance itself, not on
//      a position-keyed side map — fixes the
//      old index-bound bug where reordering the
//      Shield in hand silently transferred the
//      discount/visual-reveal onto another card.
//      The instance is auto-untracked when the
//      copy leaves hand (played, discarded,
//      deleted), so the flag — and therefore
//      the discount — evaporates with it. A
//      freshly drawn un-revealed copy correctly
//      costs 20 again, matching the "this card"
//      wording.
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
   * at least one currently-revealed Bamboo Shield in hand. We walk
   * `engine.cardInstances` for tracked Bamboo Shields owned by this
   * player in zone='hand' with the per-instance `_permanentlyRevealed`
   * flag — the flag follows the instance, so reordering or mid-hand
   * splicing no longer transfers the reveal onto another card. The
   * flag goes away with the instance when the copy is spliced out,
   * so the discount auto-reverts as soon as no revealed copy remains.
   */
  dynamicCost(gs, playerIdx, engine) {
    if (!engine) return BASE_COST;
    for (const inst of engine.cardInstances || []) {
      if (inst.owner !== playerIdx) continue;
      if (inst.zone !== 'hand') continue;
      if (inst.name !== CARD_NAME) continue;
      if (!inst.counters?._permanentlyRevealed) continue;
      return REVEALED_COST;
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
     * controller: permanently reveal THIS copy to lock the cost
     * discount? The reveal flag lives on the CardInstance itself
     * (`counters._permanentlyRevealed`), so it follows the physical
     * copy through hand reorders, mid-hand inserts, and any other
     * mutation — no index bookkeeping required. When the revealed
     * copy is eventually played / discarded / deleted, its instance
     * is untracked and the flag (along with the cost discount)
     * disappears with it.
     */
    onCardAddedFromDiscardToHand: async (ctx) => {
      // Only react to OUR own copy entering OUR hand.
      if (ctx.playerIdx !== ctx.cardOwner) return;
      if (ctx.addedCardName !== CARD_NAME) return;
      // Filter to the freshly-recovered instance — without this, every
      // existing Bamboo Shield in hand would also fire the prompt.
      if (ctx.addedCard?.id !== ctx.card.id) return;
      // Already revealed (e.g. instance was recovered, revealed, and
      // somehow re-entered the same hook path) — no re-prompt.
      if (ctx.card.counters?._permanentlyRevealed) return;

      const engine = ctx._engine;
      const gs     = engine.gs;
      const pi     = ctx.cardOwner;
      const ps     = gs.players[pi];
      if (!ps) return;

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

      // Defensive: only stamp if the instance is still in this player's
      // hand — between the prompt opening and now, hand-mutating effects
      // could have moved it elsewhere (none currently do, but cheap to
      // check). Stamping on a non-hand instance would do nothing useful.
      if (ctx.card.zone !== 'hand') return;

      // Per-instance reveal flag. `_bambooRevealed` is kept as an
      // alias so per-copy bamboo-only logic (existing or future) still
      // reads true; `_permanentlyRevealed` is the generic surface that
      // the server's reveal-broadcast layer scans for.
      ctx.card.counters._permanentlyRevealed = true;
      ctx.card.counters._bambooRevealed = true;

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
