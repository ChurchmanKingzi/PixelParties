// ═══════════════════════════════════════════
//  CARD EFFECT: "Graveyard of Limited Power"
//  Spell (Decay Magic Lv1, Area)
//
//  All damage targets controlled by the player
//  with MORE cards in their discard pile take
//  from Creature effects is increased by 50.
//
//  Implementation:
//    • Self-place into the caster's Area zone
//      via the standard onPlay → placeArea path
//      (mirrors Acid Rain / The Cosmic Depths).
//    • Passive damage modifier wired through
//      `beforeDamage` (hero targets) and
//      `beforeCreatureDamageBatch` (creature
//      targets). Both hooks gate on:
//        – Card is currently in 'area' zone
//        – Source is a Creature card
//        – Target's controller is the player
//          with the LARGER discardPile.length
//          (ties: no bonus)
//    • Per-tick comparison: discard counts are
//      re-read at hook time, so the buff swings
//      sides immediately when a discard cascade
//      flips the lead.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

/** Player index with strictly more discard-pile cards, or -1 on tie. */
function playerWithMoreDiscard(gs) {
  const a = (gs.players[0]?.discardPile || []).length;
  const b = (gs.players[1]?.discardPile || []).length;
  if (a > b) return 0;
  if (b > a) return 1;
  return -1;
}

/** Treat the source as a Creature effect iff its name resolves to a Creature card. */
function isCreatureSource(engine, source) {
  if (!source?.name) return false;
  const cd = engine._getCardDB()[source.name];
  if (!cd) return false;
  return hasCardType(cd, 'Creature');
}

module.exports = {
  // 'hand' for the self-cast onPlay; 'area' for the passive damage hooks.
  activeIn: ['hand', 'area'],

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card.id) return;
      await ctx._engine.placeArea(ctx.cardOwner, ctx.card);
    },

    // Hero-target damage path (actionDealDamage → BEFORE_DAMAGE).
    beforeDamage: (ctx) => {
      if (ctx.cardZone !== 'area') return;
      const engine = ctx._engine;
      if (!isCreatureSource(engine, ctx.source)) return;
      const target = ctx.target;
      if (!target || target.hp === undefined) return;
      const targetOwner = engine._findHeroOwner?.(target);
      if (targetOwner == null || targetOwner < 0) return;
      const losingPi = playerWithMoreDiscard(engine.gs);
      if (losingPi < 0) return;
      if (targetOwner !== losingPi) return;
      ctx.setAmount((ctx.amount || 0) + 50);
    },

    // Creature-target damage path (processCreatureDamageBatch).
    beforeCreatureDamageBatch: (ctx) => {
      if (ctx.cardZone !== 'area') return;
      const engine = ctx._engine;
      const losingPi = playerWithMoreDiscard(engine.gs);
      if (losingPi < 0) return;
      const entries = ctx.entries || [];
      for (const e of entries) {
        if (e.cancelled) continue;
        if (!e.inst) continue;
        if (!isCreatureSource(engine, e.source)) continue;
        if ((e.inst.controller ?? e.inst.owner) !== losingPi) continue;
        e.amount = (e.amount || 0) + 50;
      }
    },
  },
};
