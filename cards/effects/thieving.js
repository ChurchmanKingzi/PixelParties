// ═══════════════════════════════════════════
//  CARD EFFECT: "Thieving"
//  Ability — Free activation once per turn
//
//  Lv1: Steal up to 4 Gold from the opponent.
//  Lv2: Steal up to 8 Gold.
//  Lv3: Steal up to 12 Gold.
//
//  Amount is clamped at the opponent's current
//  Gold. Fizzles when opponent is at 0 Gold or
//  during the opening turn — both rules live in
//  the shared stealGoldFromOpponent helper.
//  Once-per-turn is enforced by the engine's
//  standard free-ability HOPT path.
// ═══════════════════════════════════════════

const STEAL_BY_LEVEL = [4, 8, 12];
const CARD_NAME = 'Thieving';

module.exports = {
  activeIn: ['ability'],
  freeActivation: true,

  /**
   * Unusable while the opponent has 0 Gold or during Turn-1 protection.
   * The helper would fizzle in those cases anyway, but surfacing it
   * here greys out the ability button client-side so the player
   * doesn't burn their click on a no-op.
   */
  canFreeActivate(ctx) {
    const gs = ctx._engine.gs;
    const pi = ctx.cardOwner;
    const oi = pi === 0 ? 1 : 0;
    if (gs.firstTurnProtectedPlayer === oi) return false;
    const ops = gs.players[oi];
    return !!(ops && (ops.gold || 0) > 0);
  },

  async onFreeActivate(ctx, level) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const lv = Math.max(1, Math.min(3, level | 0));
    const amount = STEAL_BY_LEVEL[lv - 1];

    const { stolen } = await engine.actionStealGold(pi, amount, {
      sourceName: CARD_NAME,
    });

    engine.log('thieving_activated', {
      player: engine.gs.players[pi]?.username,
      hero: ctx.heroName ? ctx.heroName() : null,
      level: lv,
      maxSteal: amount,
      stolen,
    });
  },
};
