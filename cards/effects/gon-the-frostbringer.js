// ═══════════════════════════════════════════
//  CARD EFFECT: "Gon, the Frostbringer"
//  Hero (400 HP, 40 ATK)
//  Starting abilities: Magic Arts, Resistance
//
//  Passive: All YOUR effects that Freeze one or
//  more targets Freeze them for an additional
//  turn. The engine's `processStatusExpiry`
//  reads `frozen.duration` to allow multi-turn
//  freezes — this listener bumps that field on
//  every Freeze application from Gon's side.
//
//  Counterpart: Goff, the Burnbringer (Creature)
//  declares `attachableHeroes: ['Gon, the
//  Frostbringer']`, so a deck-card copy of Gon
//  can be tucked underneath a Goff for Goff's
//  bonus stats / Burn-doubling effect. While
//  attached, the Hero is INERT — these hooks
//  fire only when Gon is on a hero zone (the
//  team), never when Gon is sitting under a
//  Creature (he's not tracked as an instance
//  there; the engine's runHooks listener filter
//  skips him naturally).
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['hero'],

  hooks: {
    /**
     * "All YOUR effects that Freeze … freeze for an additional turn."
     * The active player at the moment a Frozen status is applied is
     * the side whose effect is resolving — if that's Gon's owner, we
     * extend the Frozen duration by 1. The engine's status-expiry
     * pass at end-of-active-player's-turn already supports
     * `frozen.duration > 1` (multi-turn freezes tick down instead
     * of clearing), so all we need is to bump the field.
     *
     * Limitations:
     *   • Creature freezes are stored as `inst.counters.frozen = 1`
     *     with no duration field, and they don't fire ON_STATUS_APPLIED
     *     — so this listener only extends Hero freezes today. If/when
     *     creature-freeze duration becomes a thing, the same shape can
     *     extend it (just hook a creature-status-applied event).
     */
    onStatusApplied: async (ctx) => {
      if (ctx.statusName !== 'frozen') return;
      const engine = ctx._engine;
      const gs = engine.gs;
      // "Your effects" — fire only when the side whose turn is
      // currently active is Gon's controller. The vast majority of
      // freezes are applied during the caster's own turn (their
      // effect resolution); reactive surprise-applied freezes also
      // fire while their owner is the active player.
      if (gs.activePlayer !== ctx.cardOwner) return;

      const hero = ctx.target;
      if (!hero || !hero.statuses?.frozen) return;
      const cur = hero.statuses.frozen.duration ?? 1;
      hero.statuses.frozen.duration = cur + 1;
      engine.log('gon_freeze_extend', {
        target: hero.name,
        newDuration: hero.statuses.frozen.duration,
      });
    },
  },
};
