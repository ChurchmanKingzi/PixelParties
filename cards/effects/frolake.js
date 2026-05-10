// ═══════════════════════════════════════════
//  CARD EFFECT: "Frolake"
//  Creature (Normal, Lv1, Summoning Magic) — BANNED
//
//  ① When summoned: draw 2 cards.
//  ② At the end of each of your turns, you may
//    discard any number of cards from your hand,
//    then draw until you have 4 cards in hand.
//
//  Implementation:
//   • `onSummon` — straight `actionDrawCards(pi, 2)`.
//   • `onTurnEnd` — fires only on the controller's
//     own turn (`activePlayer === pi`). Iterative
//     `forceDiscardCancellable` so the player
//     can stop whenever they like; afterwards a
//     single `actionDrawCards(pi, max(0, 4-len))`
//     refills the hand. Skipped while CC'd
//     (negated/nulled) — the engine's runHooks
//     filter handles frozen/stunned, but the
//     creature-counter check is owned here.
// ═══════════════════════════════════════════

const CARD_NAME = 'Frolake';

module.exports = {
  activeIn: ['support'],

  hooks: {
    /**
     * Summon trigger — engine convention is `onPlay` for both
     * hand-played and placement summons (no separate `onSummon`
     * hook). Filter to THIS Frolake's own summon via
     * `ctx.playedCard.id === ctx.card.id`, and require the inst is
     * landing in support so an in-hand-listener path (none today,
     * but defensive) wouldn't double-fire.
     */
    onPlay: async (ctx) => {
      if (ctx.playedCard?.id !== ctx.card.id) return;
      if (ctx.cardZone !== 'support') return;
      const engine = ctx._engine;
      const pi = ctx.cardOwner;

      // EXPLICIT post-summon sync before the draws. Without this,
      // `summonCreatureWithHooks` mutates state silently (no sync)
      // and fires onPlay immediately afterwards — so by the time
      // `actionDrawCards`' iter-0 sync hits the client, the
      // post-summon hand-shrink (Frolake leaves hand) and the
      // iter-0 draw (hand +1) collapse into a single render with
      // net delta=0, and the first draw's hand-fly-in animation
      // is skipped. Forcing a sync here, then a 300ms delay so
      // React commits the post-summon frame, lets each draw's sync
      // arrive with a clean +1 delta. Iter 1 gets the engine's own
      // 300ms inter-draw stagger.
      engine.sync();
      await engine._delay(300);

      await engine.actionDrawCards(pi, 2);
      engine.log('frolake_on_summon_draw', {
        player: engine.gs.players[pi]?.username, drew: 2,
      });
      engine.sync();
    },

    /**
     * End-of-own-turn cycle: discard-any → draw-to-4. The discard
     * loop is opt-in per iteration (forceDiscardCancellable with a
     * "Done" cancel). Once the player commits to the loop's exit,
     * we top up to exactly 4 — clamped non-negative when the player
     * already exceeds 4 (in which case no draw fires).
     */
    onTurnEnd: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const inst = ctx.card;
      const pi = ctx.cardOwner;

      if (ctx.activePlayer !== pi) return;
      if (!inst || inst.zone !== 'support') return;
      if (inst.counters?.negated || inst.counters?.nulled) return;
      const hero = ctx.attachedHero;
      if (!hero?.name || hero.hp <= 0) return;

      const ps = gs.players[pi];
      if (!ps) return;

      // Discard loop — caster controls the count via the cancel
      // button. Each iteration excludes any in-flight resolving
      // card so a Spell mid-resolve isn't accidentally discarded
      // (defensive — onTurnEnd usually runs with no resolving
      // card, but Skull Necklace and other reactive triggers may
      // queue mid-flow).
      while ((ps.hand?.length || 0) > 0) {
        const eligible = (ps.hand || []).map((_, i) => i);
        const result = await engine.promptGeneric(pi, {
          type: 'forceDiscardCancellable',
          title: CARD_NAME,
          description: `Discard any number of cards, then draw until you have 4. (${ps.hand.length} in hand)`,
          instruction: 'Click a card in your hand to discard it, or Done to refill.',
          eligibleIndices: eligible,
          cancellable: true,
          cancelLabel: 'Done',
        });
        if (!result || result.cancelled || result.cardName == null) break;
        const ok = await engine.actionDiscardHandCard(pi, result.cardName, result.handIndex, {
          source: CARD_NAME,
        });
        if (!ok) break;
      }

      const need = Math.max(0, 4 - (ps.hand?.length || 0));
      if (need > 0) {
        await engine.actionDrawCards(pi, need);
        engine.log('frolake_refill', {
          player: ps.username, target: 4, drew: need,
        });
      } else {
        engine.log('frolake_refill_skip', {
          player: ps.username, handSize: ps.hand?.length || 0,
        });
      }
      engine.sync();
    },
  },
};
