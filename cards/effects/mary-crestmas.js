// ═══════════════════════════════════════════
//  HERO EFFECT: "Mary Crestmas"  (Crestmas, Crystals)
//
//  ① Whenever you add one or more cards from
//    your hand to your opponent's hand, you may
//    draw the same number of cards.
//  ② Once per turn, when this Hero would take
//    damage, you may force your opponent to
//    discard a card originally owned by you from
//    their hand to negate that damage.
//
//  Implementation:
//   • Listener (a) hooks on the new
//     `onCardTransferredToOppHand` and offers a
//     "may draw" confirm. Triggers PER CARD —
//     the helper fires the hook once per
//     transferred card, so a multi-card transfer
//     queues N independent prompts (the user
//     can accept each individually).
//   • Listener (b) hooks `beforeDamage`, gated
//     to Mary herself + a per-turn HOPT. The
//     "may" prompt opens only when opp has at
//     least one originally-Mary-side card in
//     hand to discard; otherwise the trigger
//     silently skips.
// ═══════════════════════════════════════════

const CARD_NAME = 'Mary Crestmas';

module.exports = {
  activeIn: ['hero'],

  hooks: {
    /**
     * Reset Mary's per-turn damage-negation HOPT at the start of her
     * controller's turn. Stored on the inst so multiple Marys would
     * each get their own HOPT slot — though deck rules generally
     * prevent that.
     */
    onTurnStart: (ctx) => {
      if (ctx.activePlayer !== ctx.cardOriginalOwner) return;
      const inst = ctx.card;
      if (inst?.counters?._maryNegateUsed) {
        delete inst.counters._maryNegateUsed;
      }
    },

    /**
     * Effect ①: draw on hand-to-opp-hand transfers initiated by
     * Mary's controller. The hook fires once per card transferred,
     * so multi-card transfers cascade naturally.
     */
    onCardTransferredToOppHand: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      // Only fire when WE are the giver — receiving cards from opp
      // doesn't count.
      if (ctx.fromPi !== pi) return;
      const hero = ctx.attachedHero;
      if (!hero?.name || hero.hp <= 0) return;
      const ps = engine.gs.players[pi];
      if (!ps || ps.handLocked) return;

      const confirmed = await ctx.promptConfirmEffect({
        title: CARD_NAME,
        message: `${ctx.cardName} just left your hand for ${engine.gs.players[ctx.toPi]?.username || 'your opponent'}'s. Draw 1 card?`,
      });
      if (!confirmed) return;

      await engine.actionDrawCards(pi, 1);
      engine.log('mary_crestmas_draw', {
        player: ps.username, transferred: ctx.cardName,
      });
      engine.sync();
    },

    /**
     * Effect ②: pre-damage HOPT-gated negation. Targets Mary
     * specifically — incoming damage to other heroes / creatures on
     * the same side doesn't trigger this. The "may" confirm opens
     * only when opp actually has an originally-pi-side card to
     * discard, otherwise the trigger fizzles silently and HOPT is
     * preserved.
     */
    beforeDamage: async (ctx) => {
      const inst = ctx.card;
      if (!inst) return;
      if (inst.counters?._maryNegateUsed) return;

      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const oi = pi === 0 ? 1 : 0;
      const heroIdx = ctx.cardHeroIdx;
      const myHero = engine.gs.players[pi]?.heroes?.[heroIdx];
      if (!myHero || myHero.hp <= 0) return;
      // The hook fires for every damage event in the engine — only
      // react when the target IS Mary herself.
      if (ctx.target !== myHero) return;

      // Mary needs an opp-hand card originally owned by us to use
      // as the discard cost. Walk opp's tracked instances and find
      // those with `originalOwner === pi`.
      const ops = engine.gs.players[oi];
      if (!ops) return;
      const eligibleHandIdxs = [];
      for (let i = 0; i < (ops.hand || []).length; i++) {
        const cn = ops.hand[i];
        let rank = 0;
        for (let j = 0; j < i; j++) if (ops.hand[j] === cn) rank++;
        let seen = 0;
        for (const c of (engine.cardInstances || [])) {
          if (c.owner !== oi || c.zone !== 'hand' || c.name !== cn) continue;
          if (seen === rank) {
            const orig = c.originalOwner ?? oi;
            if (orig === pi) eligibleHandIdxs.push(i);
            break;
          }
          seen++;
        }
      }
      if (eligibleHandIdxs.length === 0) return;

      const confirmed = await ctx.promptConfirmEffect({
        title: CARD_NAME,
        message: `${myHero.name} would take ${ctx.amount} damage. Force ${ops.username} to discard one of your originally-owned cards from their hand to negate it?`,
      });
      if (!confirmed) return;

      // Force the opp to discard one of their originally-pi-owned
      // hand cards via `forceDiscard` with eligibility filter. The
      // discard is mandatory (forceDiscard, non-cancellable) once
      // Mary's controller commits — opp picks WHICH card.
      // Re-collect indices in case the hand mutated mid-prompt.
      const reEligible = [];
      for (let i = 0; i < (ops.hand || []).length; i++) {
        const cn = ops.hand[i];
        let rank = 0;
        for (let j = 0; j < i; j++) if (ops.hand[j] === cn) rank++;
        let seen = 0;
        for (const c of (engine.cardInstances || [])) {
          if (c.owner !== oi || c.zone !== 'hand' || c.name !== cn) continue;
          if (seen === rank) {
            const orig = c.originalOwner ?? oi;
            if (orig === pi) reEligible.push(i);
            break;
          }
          seen++;
        }
      }
      if (reEligible.length === 0) return;

      const dRes = await engine.promptGeneric(oi, {
        type: 'forceDiscard',
        title: CARD_NAME,
        description: `${ops.username}, discard one of your opponent's originally-owned cards to negate ${ctx.amount} damage to ${myHero.name}.`,
        instruction: 'Click a highlighted card in your hand to discard it.',
        eligibleIndices: reEligible,
        cancellable: false,
      });
      if (!dRes || dRes.cardName == null) return;

      const ok = await engine.actionDiscardHandCard(oi, dRes.cardName, dRes.handIndex, {
        source: CARD_NAME,
      });
      if (!ok) return;

      // Cost paid — claim Mary's HOPT and cancel the damage.
      if (!inst.counters) inst.counters = {};
      inst.counters._maryNegateUsed = true;
      ctx.cancel();
      engine.log('mary_crestmas_negate', {
        player: engine.gs.players[pi]?.username,
        attacker: ctx.source?.name || 'unknown',
        forcedDiscard: dRes.cardName,
      });
      engine.sync();
    },
  },
};
