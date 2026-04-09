// ═══════════════════════════════════════════
//  CARD EFFECT: "Medea, the Swamp Witch"
//  Hero — Passive effect:
//
//  For each living, non-negated Medea a player
//  controls, all Poison damage dealt to their
//  OPPONENT is doubled.
//
//  1 Medea: ×2 (60 per stack)
//  2 Medeas: ×4 (120 per stack)
//  3 Medeas: ×8 (240 per stack)
//
//  Implemented via the modifyPoisonDamage hook.
//  The hook fires for the player TAKING damage;
//  we count living non-negated Medeas on the
//  opponent's side to determine the multiplier.
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['hero'],

  hooks: {
    /**
     * Modify poison damage dealt to a player.
     * ctx.playerIdx = the player taking poison damage.
     * We count Medeas on the OPPONENT's side.
     * Each card only needs to report itself — the hook
     * fires once per registered card instance, so we
     * just double the amount each time this card's
     * hook fires (if the Medea is alive and un-negated).
     */
    modifyPoisonDamage(ctx) {
      // This hook fires for the card instance (Medea) that owns it.
      // Only boost if this Medea belongs to the OPPONENT of the player taking damage.
      if (ctx.cardOwner === ctx.playerIdx) return;

      // Check this Medea is alive and not negated
      const hero = ctx.attachedHero;
      if (!hero || !hero.name || hero.hp <= 0) return;
      if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) return;

      // Double the damage
      ctx.setAmount(ctx.amount * 2);
    },
  },
};
