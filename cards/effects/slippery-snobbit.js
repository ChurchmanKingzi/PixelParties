// ═══════════════════════════════════════════
//  CARD EFFECT: "Slippery Snobbit"
//  Creature (Summoning Magic Lv1, 30 HP — Slippery)
//
//  At the beginning of each of your turns, slide
//  this Creature into the free Support Zone of an
//  adjacent Hero (if possible).
//
//  When this Creature is moved into a different
//  Hero's Support Zone, you may discard any number
//  of cards and draw the same number. If at least
//  one discarded card carried the "Slippery"
//  archetype, draw 1 additional card.
//
//  Wiring:
//   • The discard pass runs inside a single
//     `withDiscardBatch` window — on-discard
//     reactors (Cute Bunny, Skull Necklace, Glass
//     of Marbles, etc.) see one N-card batch event
//     rather than N independent 1-card events. The
//     `forceDiscardCancellable` prompt lets the
//     player click ANY card in hand directly to
//     discard it (no `eligibleIndices` filter) and
//     pass a Done button to stop.
//   • Draw count = (discarded count) + (Slippery-
//     was-among-them ? 1 : 0). Zero discards = zero
//     draws (legal — the rider is "may discard any
//     number" and "any number" includes zero).
// ═══════════════════════════════════════════

const { onSlipperyTurnStart, slipperyOnMoveGate, isSlipperyCard } = require('./_slippery-shared');

const CARD_NAME = 'Slippery Snobbit';

module.exports = {
  activeIn: ['support'],

  hooks: {
    onTurnStart: onSlipperyTurnStart,

    onCardEnterZone: async (ctx) => {
      if (!slipperyOnMoveGate(ctx)) return;
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const ps = engine.gs.players[pi];
      if (!ps) return;

      // If the hand is empty AND we can't draw, there's nothing to
      // offer — silent bail. (handLocked draws no-op downstream.)
      if ((ps.hand?.length || 0) === 0 && ps.handLocked) return;

      const batch = await engine.withDiscardBatch(pi, { source: CARD_NAME }, async () => {
        let n = 0;
        let slipperyTouched = false;
        while ((ps.hand?.length || 0) > 0) {
          const isFirst = n === 0;
          const result = await engine.promptGeneric(pi, {
            type: 'forceDiscardCancellable',
            title: CARD_NAME,
            description: isFirst
              ? 'You may discard any number of cards. Draw the same number. Discarding any Slippery card adds +1 draw.'
              : `Discard another card, or click Done. (${n} discarded so far.)`,
            instruction: 'Click a card in your hand to discard it.',
            cancellable: true,
            cancelLabel: 'Done',
          });
          if (!result || result.cancelled || result.cardName == null) break;
          const cardName = result.cardName;
          const ok = await engine.actionDiscardHandCard(pi, cardName, result.handIndex, {
            source: CARD_NAME,
          });
          if (!ok) break;
          if (isSlipperyCard(cardName, engine)) slipperyTouched = true;
          n++;
        }
        return { count: n, slipperyTouched };
      });

      const drawCount = (batch?.count || 0) + (batch?.slipperyTouched ? 1 : 0);
      if (drawCount <= 0) return;

      // Brief beat so the discard-batch syncs commit before the draw
      // animations fire — same "post-discard / pre-draw" timing fix
      // used for Pteranos / Heinz / Triceras (without it, React batches
      // the discard-shrink + draw-grow into one render with delta=0
      // and the first draw's animation is lost).
      await engine._delay(300);

      await engine.actionDrawCards(pi, drawCount);

      engine.log('slippery_snobbit_cycle', {
        player: ps.username,
        discarded: batch?.count || 0,
        slipperyBonus: !!batch?.slipperyTouched,
        drew: drawCount,
      });
      engine.sync();
    },
  },
};
