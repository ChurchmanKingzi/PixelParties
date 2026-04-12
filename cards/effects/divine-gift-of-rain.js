// ═══════════════════════════════════════════
//  CARD EFFECT: "Divine Gift of Rain"
//  Spell (Magic Arts Lv2, Post-Target Reaction)
//
//  Once per game (shared "Divine Gift" key).
//  Fires when 1+ targets the player controls
//  would be affected by an opponent's card or
//  effect. Negates the effect entirely.
//
//  Uses isPostTargetReaction so it fires AFTER
//  targets are known (single-target, AoE heroes,
//  AoE creatures) — not speculatively in the
//  chain window.
//
//  Triggers a full-screen rain animation
//  that persists for the rest of the turn.
// ═══════════════════════════════════════════

module.exports = {
  isPostTargetReaction: true,
  oncePerGame: true,
  oncePerGameKey: 'divineGift',

  /**
   * Condition: the source card is owned by the opponent,
   * and at least one targeted entity belongs to this player.
   */
  postTargetCondition(gs, pi, engine, targetedHeroes, sourceCard) {
    if (!targetedHeroes || targetedHeroes.length === 0) return false;

    // Source must be an opponent's card/effect
    const srcOwner = sourceCard?.controller ?? sourceCard?.owner ?? -1;
    if (srcOwner === pi) return false;

    // At least one target must belong to this player
    const hasOwnTarget = targetedHeroes.some(t => t.owner === pi);
    if (!hasOwnTarget) return false;

    return true;
  },

  /**
   * Resolve: negate the effect, play rain animation, mark Divine Gift as used.
   */
  async postTargetResolve(engine, pi, targetedHeroes, sourceCard) {
    const gs = engine.gs;
    const ps = gs.players[pi];

    // Mark Divine Gift as used for the game
    if (!ps._oncePerGameUsed) ps._oncePerGameUsed = new Set();
    ps._oncePerGameUsed.add('divineGift');

    // Rain animation (persists for rest of turn)
    engine._broadcastEvent('divine_rain_start', { turn: gs.turn });
    await engine._delay(600);

    engine.log('divine_gift_of_rain', {
      player: ps?.username,
      negated: sourceCard?.name || 'an effect',
    });

    engine.sync();

    // Negate the entire effect
    return { effectNegated: true };
  },
};
