// ═══════════════════════════════════════════
//  CARD EFFECT: "Stinky Stables"
//  Spell (Decay Magic Lv1, Area)
//
//  While this Area is in play, Poisoned targets
//  can't be healed (their HP AND their Poison).
//
//  The lockout is wired generically: this script
//  exports `blocksPoisonHeal: true`, and the
//  engine's `_isPoisonHealLocked()` scans every
//  Area instance for the flag. The actual gate
//  checks live in actionHealHero /
//  actionHealCreature / removeHeroStatus /
//  cleanseHeroStatuses / cleanseCreatureStatuses.
// ═══════════════════════════════════════════

module.exports = {
  // Active in 'hand' so the self-cast onPlay hook fires; 'area' keeps the
  // instance around while it's in play (no ongoing hooks needed — the
  // lockout is read at call-time from gs.areaZones).
  activeIn: ['hand', 'area'],
  // Engine-level opt-in: consulted by `_isPoisonHealLocked()`. Any
  // future Area that should block heals on Poisoned targets sets the
  // same flag and plugs in automatically.
  blocksPoisonHeal: true,

  hooks: {
    // Self-placement on cast: move the card from hand into the Area zone.
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card.id) return;
      await ctx._engine.placeArea(ctx.cardOwner, ctx.card);
    },
  },
};
