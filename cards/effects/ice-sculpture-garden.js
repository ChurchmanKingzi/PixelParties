// ═══════════════════════════════════════════
//  CARD EFFECT: "Ice Sculpture Garden"
//  Spell — Magic Arts Lv1
//
//  Draw as many cards as there are Frozen
//  targets on the board. If there are at least
//  2 Frozen targets, this counts as an
//  additional Action. After resolving, the
//  caster's hand is locked for the rest of the
//  turn (handLocked = true) — blocks further
//  draws AND deck searches per the engine's
//  standard hand-lock semantics.
// ═══════════════════════════════════════════

const { countFrozenTargets } = require('./_mischief-militia-shared');

const CARD_NAME = 'Ice Sculpture Garden';

module.exports = {
  // Free-action when there are ≥2 Frozen targets on the board.
  inherentAction(gs, pi, heroIdx, engine) {
    if (!engine) return false;
    return countFrozenTargets(engine) >= 2;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const ps = engine.gs.players[pi];
      if (!ps) return;

      const n = countFrozenTargets(engine);
      if (n > 0) {
        // Animated draw — paces each card by `CARD_FLOW_PACE_MS`
        // (250 ms) and adds a matching trailing settle so the last
        // draw's reveal animation finishes before Garden itself heads
        // to the discard pile. The canonical wrapper for any "draw N
        // then run another animation" card.
        await ctx.drawCardsAnimated(pi, n);
      }

      // Hand-lock for the rest of this turn — the engine clears
      // `handLocked` at the player's next turn-start (see _engine.js
      // turn-boundary cleanup). Blocks draws AND hand-additions, which
      // matches the updated card text.
      ps.handLocked = true;

      engine.log('ice_sculpture_garden', {
        player: ps.username, drawn: n,
      });
      engine.sync();
    },
  },
};
