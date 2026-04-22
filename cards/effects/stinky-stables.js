// ═══════════════════════════════════════════
//  CARD EFFECT: "Stinky Stables"
//  Spell (Decay Magic Lv1, Area)
//
//  While this Area is in play, Poisoned targets
//  can't be healed (their HP AND their Poison).
//
//  The blocking logic lives in the engine — see
//  `_isPoisonHealLocked()` in _engine.js and the
//  checks inside actionHealHero / actionHealCreature
//  / removeHeroStatus / cleanseHeroStatuses /
//  cleanseCreatureStatuses. This card script just
//  handles placement.
// ═══════════════════════════════════════════

module.exports = {
  // Active in 'hand' so the self-cast onPlay hook fires; 'area' keeps the
  // instance around while it's in play (no ongoing hooks needed — the
  // lockout is read at call-time from gs.areaZones).
  activeIn: ['hand', 'area'],

  hooks: {
    // Self-placement on cast: move the card from hand into the Area zone.
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card.id) return;
      await ctx._engine.placeArea(ctx.cardOwner, ctx.card);
    },
  },
};
